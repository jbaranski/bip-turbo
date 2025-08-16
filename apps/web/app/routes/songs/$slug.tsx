import type { SongPagePerformance, SongPageView } from "@bip/domain";
import {
  type SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowLeft, ArrowUpIcon, FileTextIcon, GuitarIcon, Pencil, StarIcon } from "lucide-react";
import { useState } from "react";
import Masonry from "react-masonry-css";
import type { LoaderFunctionArgs } from "react-router";
import { Link } from "react-router-dom";
import { AdminOnly } from "~/components/admin/admin-only";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useSerializedLoaderData } from "~/hooks/use-serialized-loader-data";
import { publicLoader } from "~/lib/base-loaders";
import { getSongMeta, getSongStructuredData } from "~/lib/seo";
import { cn } from "~/lib/utils";
import { services } from "~/server/services";

export const loader = publicLoader(async ({ request, params }: LoaderFunctionArgs): Promise<SongPageView> => {
  const slug = params.slug;
  if (!slug) throw new Response("Not Found", { status: 404 });

  return services.songPageComposer.build(slug);
});

interface StatBoxProps {
  label: string;
  value: string | number;
  sublabel?: string;
}

function StatBox({ label, value, sublabel }: StatBoxProps) {
  return (
    <div className="glass-content p-6 rounded-lg">
      <dt className="text-sm font-medium text-content-text-secondary">{label}</dt>
      <dd className="mt-2">
        <span className="text-3xl font-bold text-content-text-primary">{value}</span>
        {sublabel && <span className="ml-2 text-sm text-content-text-tertiary">{sublabel}</span>}
      </dd>
    </div>
  );
}

function PerformanceTable({ performances: initialPerformances }: { performances: SongPagePerformance[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);

  const handleSortingChange = (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
    setSorting(updaterOrValue);
  };

  const columnHelper = createColumnHelper<SongPagePerformance>();
  const columns = [
    columnHelper.accessor("show.date", {
      id: "date",
      header: "Date",
      size: 128,
      enableSorting: true,
      sortingFn: "datetime",
      cell: (info) => (
        <a href={`/shows/${info.row.original.show.slug}`} className="text-brand-primary hover:text-brand-secondary">
          {info.getValue()}
        </a>
      ),
    }),
    columnHelper.accessor(
      (row) => ({
        name: row.venue?.name,
        city: row.venue?.city,
        state: row.venue?.state,
        slug: row.show.slug,
      }),
      {
        id: "venue",
        header: "Venue",
        enableSorting: false,
        cell: (info) => {
          const venue = info.getValue();
          return venue.city ? (
            <a href={`/shows/${venue.slug}`} className="text-brand-primary hover:text-brand-secondary">
              {venue.name}
              <br />
              {venue.city}, {venue.state}
            </a>
          ) : null;
        },
      },
    ),
    columnHelper.accessor(
      (row) => ({
        title: row.songBefore?.songTitle,
        slug: row.songBefore?.songSlug,
        segue: row.songBefore?.segue,
      }),
      {
        id: "before",
        header: "Song before",
        size: 192,
        enableSorting: false,
        cell: (info) => {
          const song = info.getValue();
          return song.slug ? (
            <a href={`/songs/${song.slug}`} className="text-content-text-secondary hover:text-brand-primary">
              {song.title} {song.segue ? ">" : ""}
            </a>
          ) : null;
        },
      },
    ),
    columnHelper.accessor(
      (row) => ({
        title: row.songAfter?.songTitle,
        slug: row.songAfter?.songSlug,
        segue: row.songAfter?.segue,
      }),
      {
        id: "after",
        header: "Song after",
        size: 192,
        enableSorting: false,
        cell: (info) => {
          const song = info.getValue();
          return song.slug ? (
            <a href={`/songs/${song.slug}`} className="text-content-text-secondary hover:text-brand-primary">
              {song.title} {song.segue ? ">" : ""}
            </a>
          ) : null;
        },
      },
    ),
    columnHelper.accessor("rating", {
      header: "Rating",
      size: 64,
      enableSorting: true,
      cell: (info) => {
        const rating = info.getValue();
        return rating && rating > 0 ? (
          <span className="text-right block">{`★ ${rating.toFixed(1)}`}</span>
        ) : (
          <span className="text-right block">—</span>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: initialPerformances,
    columns,
    state: {
      sorting,
    },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting: true,
    enableMultiSort: false,
  });

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-md">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="text-left text-sm text-content-text-secondary">
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="p-3" style={{ width: header.getSize() }}>
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      className={
                        header.column.getCanSort()
                          ? "cursor-pointer select-none hover:text-content-text-primary w-full text-left"
                          : "w-full text-left"
                      }
                      onClick={(e) => {
                        header.column.toggleSorting();
                      }}
                    >
                      <span className={header.column.getIsSorted() ? "text-content-text-primary font-semibold" : ""}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                      {header.column.getIsSorted() && (
                        <span className="text-brand-primary ml-1">
                          {header.column.getIsSorted() === "asc" ? (
                            <ArrowUpIcon className="h-4 w-4 inline" />
                          ) : (
                            <ArrowDownIcon className="h-4 w-4 inline" />
                          )}
                        </span>
                      )}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t border-glass-border/30 hover:bg-hover-glass">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewNote({ notes }: { notes: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Split by newlines to count lines, but also account for long lines that wrap
  const lines = notes.split("\n");
  const shouldTruncate = lines.length > 6;

  const displayText = isExpanded || !shouldTruncate ? notes : lines.slice(0, 6).join("\n");

  // Only show read more if we're actually truncating content
  const isTruncated = shouldTruncate && !isExpanded && displayText.length < notes.length;

  return (
    <div className="mt-2 pt-2 border-t border-glass-border/30">
      <div className="text-sm text-content-text-tertiary leading-relaxed">
        {displayText}
        {isTruncated && (
          <>
            <span>...</span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className="text-brand-primary hover:text-brand-secondary ml-1 underline"
            >
              read more
            </button>
          </>
        )}
        {shouldTruncate && isExpanded && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(false);
            }}
            className="text-brand-primary hover:text-brand-secondary ml-2 underline"
          >
            show less
          </button>
        )}
      </div>
    </div>
  );
}

export function meta({ data }: { data: SongPageView }) {
  return getSongMeta({
    ...data.song,
    name: data.song.title,
    slug: data.song.slug,
    timesPlayed: data.song.timesPlayed,
    debutDate: data.song.debutDate
  });
}

export default function SongPage() {
  const { song, performances } = useSerializedLoaderData<SongPageView>();
  const allTimers = performances.filter((p) => p.allTimer);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: getSongStructuredData({
            ...song,
            name: song.title,
            slug: song.slug,
            timesPlayed: song.timesPlayed
          })
        }}
      />
      
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-content-text-primary">{song.title}</h1>
          {song.authorName && (
            <span className="text-content-text-secondary text-lg">
              by <span className="text-brand-primary">{song.authorName}</span>
            </span>
          )}
        </div>
        <AdminOnly>
          <Button asChild variant="outline" className="btn-secondary">
            <Link to={`/songs/${song.slug}/edit`} className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        </AdminOnly>
      </div>

      {/* Subtle back link */}
      <div className="flex justify-start">
        <Link
          to="/songs"
          className="flex items-center gap-1 text-content-text-tertiary hover:text-content-text-secondary text-sm transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>Back to songs</span>
        </Link>
      </div>

      {/* Stats Grid */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Times Played" value={song.timesPlayed} sublabel="total plays" />
        <StatBox
          label="Last Played"
          value={
            song.dateLastPlayed
              ? new Date(song.dateLastPlayed).toLocaleDateString("en-US", {
                  timeZone: "UTC",
                })
              : "Never"
          }
        />
        <StatBox label="Most Common Year" value={song.mostCommonYear || "—"} />
        <StatBox label="Least Common Year" value={song.leastCommonYear || "—"} />
      </dl>

      {song.notes && (
        <div className="glass-content rounded-lg p-4">
          <div
            className="text-md text-content-text-tertiary leading-relaxed"
            dangerouslySetInnerHTML={{ __html: song.notes }}
          />
        </div>
      )}

      <Tabs defaultValue="all-timers" className="w-full">
        <TabsList className="w-full flex justify-start border-b border-glass-border/30 rounded-none bg-transparent p-0">
          <TabsTrigger
            value="all-timers"
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-none data-[state=active]:shadow-none",
              "data-[state=active]:border-b-2 data-[state=active]:border-brand-primary data-[state=active]:bg-transparent",
              "data-[state=inactive]:bg-transparent data-[state=inactive]:text-content-text-tertiary",
            )}
          >
            <StarIcon className="h-4 w-4" />
            All-Timers
          </TabsTrigger>
          <TabsTrigger
            value="lyrics"
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-none data-[state=active]:shadow-none",
              "data-[state=active]:border-b-2 data-[state=active]:border-brand-primary data-[state=active]:bg-transparent",
              "data-[state=inactive]:bg-transparent data-[state=inactive]:text-content-text-tertiary",
            )}
          >
            <FileTextIcon className="h-4 w-4" />
            Lyrics
          </TabsTrigger>
          <TabsTrigger
            value="guitar-tabs"
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-none data-[state=active]:shadow-none",
              "data-[state=active]:border-b-2 data-[state=active]:border-brand-primary data-[state=active]:bg-transparent",
              "data-[state=inactive]:bg-transparent data-[state=inactive]:text-content-text-tertiary",
            )}
          >
            <GuitarIcon className="h-4 w-4" />
            Guitar Tabs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all-timers" className="mt-6 space-y-8">
          {allTimers.length > 0 && (
            <>
              {/* Featured Performances (with reviews) */}
              {(() => {
                const withNotes = allTimers
                  .filter((p) => p.notes)
                  .sort((a, b) => new Date(b.show.date).getTime() - new Date(a.show.date).getTime());

                return (
                  withNotes.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {withNotes.map((p) => (
                        <a
                          href={`/shows/${p.show.slug}`}
                          key={p.trackId}
                          className="glass-content block rounded-lg hover:border-brand-primary/60 transition-all duration-200 p-4"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="text-base font-medium text-content-text-primary">{p.show.date}</div>
                            {p.rating && p.rating > 0 && (
                              <div className="text-sm text-content-text-tertiary">{`★ ${p.rating.toFixed(1)}`}</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="text-brand-secondary/90 font-medium text-sm">{p.venue?.name}</div>
                            {p.venue?.city && (
                              <div className="text-xs text-content-text-tertiary">
                                {p.venue.city}, {p.venue.state}
                              </div>
                            )}
                            <ReviewNote key={p.trackId} notes={p.notes!} />
                          </div>
                        </a>
                      ))}
                    </div>
                  )
                );
              })()}

              {/* All Performances Table */}
              {(() => {
                const withoutNotes = allTimers
                  .filter((p) => !p.notes)
                  .sort((a, b) => new Date(b.show.date).getTime() - new Date(a.show.date).getTime());

                return (
                  withoutNotes.length > 0 && (
                    <div className="glass-content rounded-lg p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-content-text-secondary border-b border-glass-border/30">
                              <th className="p-3">Date</th>
                              <th className="p-3">Venue</th>
                              <th className="p-3">Location</th>
                              <th className="p-3 text-right">Rating</th>
                            </tr>
                          </thead>
                          <tbody>
                            {withoutNotes.map((p) => (
                              <tr key={p.trackId} className="border-t border-glass-border/20 hover:bg-hover-glass">
                                <td className="p-3">
                                  <a
                                    href={`/shows/${p.show.slug}`}
                                    className="text-brand-primary hover:text-brand-secondary"
                                  >
                                    {p.show.date}
                                  </a>
                                </td>
                                <td className="p-3">
                                  <a
                                    href={`/shows/${p.show.slug}`}
                                    className="text-content-text-primary hover:text-brand-primary"
                                  >
                                    {p.venue?.name}
                                  </a>
                                </td>
                                <td className="p-3 text-content-text-secondary">
                                  {p.venue?.city && `${p.venue.city}, ${p.venue.state}`}
                                </td>
                                <td className="p-3 text-right">
                                  {p.rating && p.rating > 0 ? (
                                    <span className="text-content-text-tertiary">{`★ ${p.rating.toFixed(1)}`}</span>
                                  ) : (
                                    <span className="text-content-text-tertiary">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                );
              })()}
            </>
          )}
        </TabsContent>

        <TabsContent value="lyrics" className="mt-4">
          {song.lyrics && (
            <div className="glass-content rounded-lg p-4">
              <div className="overflow-x-auto">
                <div
                  className="text-md text-content-text-tertiary leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: song.lyrics }}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="guitar-tabs" className="mt-4">
          <div className="glass-content rounded-lg p-4">
            <div className="overflow-x-auto">
              <div className="text-md text-content-text-tertiary leading-relaxed">
                {song.tabs ? (
                  <div dangerouslySetInnerHTML={{ __html: song.tabs }} />
                ) : song.guitarTabsUrl ? (
                  <a
                    href={song.guitarTabsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-primary hover:text-brand-secondary hover:underline"
                  >
                    View Guitar Tabs
                  </a>
                ) : (
                  <p>No guitar tabs available for this song.</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Performance History */}
      <div className="w-full">
        <div className="card-premium rounded-lg p-4 md:p-6">
          <h2 className="text-xl font-semibold text-content-text-primary mb-4">Performance History</h2>
          <PerformanceTable performances={performances} />
        </div>
      </div>
    </div>
  );
}
