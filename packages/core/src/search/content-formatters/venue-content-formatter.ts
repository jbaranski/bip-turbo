import type { ContentFormatter } from "./base-content-formatter";

// Helper function to safely cast venue data
function asVenue(venue: Record<string, unknown>) {
  return venue as {
    name?: string;
    city?: string;
    state?: string;
    timesPlayed?: number;
    shows?: Array<{
      date?: string;
      averageRating?: number;
    }>;
    country?: string;
    latitude?: number;
    longitude?: number;
    postalCode?: string;
  };
}

export class VenueContentFormatter implements ContentFormatter {
  entityType = "venue";

  generateDisplayText(venue: Record<string, unknown>): string {
    const v = asVenue(venue);
    let displayText = v.name || "Unknown Venue";

    if (v.city && v.state) {
      displayText += ` • ${v.city}, ${v.state}`;
    }

    if (v.timesPlayed && v.timesPlayed > 0) {
      displayText += ` • ${v.timesPlayed} shows`;
    }

    return displayText;
  }

  generateContent(venue: Record<string, unknown>): string {
    // Implementation following strategy: "[Venue Name] in [City, State]. [Times played]. Notable shows from database. [Basic characteristics from existing data]."

    const v = asVenue(venue);
    const venueName = v.name || "Unknown Venue";

    // Emphasize venue name by repeating it (like we do for songs)
    let content = `${venueName}. Venue name: ${venueName}. Concert venue: ${venueName}`;

    if (v.city && v.state) {
      content += ` in ${v.city}, ${v.state}`;
    }

    if (v.timesPlayed !== undefined) {
      content += `. Played ${v.timesPlayed} times`;
    }

    // Add notable shows from database
    if (v.shows && v.shows.length > 0) {
      const notableShows = v.shows
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
          // Sort by rating first, then by date
          if (a.averageRating && b.averageRating) {
            return (b.averageRating as number) - (a.averageRating as number);
          }
          return new Date(b.date as string).getTime() - new Date(a.date as string).getTime();
        })
        .slice(0, 5); // Top 5 shows

      if (notableShows.length > 0) {
        const showDescriptions = notableShows.map((show: Record<string, unknown>) => {
          let desc = show.date;
          if (show.averageRating && (show.averageRating as number) > 0) {
            desc += ` (★${(show.averageRating as number).toFixed(1)})`;
          }
          return desc;
        });
        content += `. Notable shows: ${showDescriptions.join(", ")}`;
      }
    }

    // Add basic characteristics from existing data
    const characteristics: string[] = [];

    if (v.country && v.country !== "USA") {
      characteristics.push(`international venue (${v.country})`);
    }

    // Add location coordinates if available
    if (v.latitude && v.longitude) {
      characteristics.push(`coordinates: ${v.latitude}, ${v.longitude}`);
    }

    // Add postal code for identification
    if (v.postalCode) {
      characteristics.push(`postal code: ${v.postalCode}`);
    }

    if (characteristics.length > 0) {
      content += `. Characteristics: ${characteristics.join(", ")}`;
    }

    return content;
  }
}
