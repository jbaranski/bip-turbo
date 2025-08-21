import type { ContentFormatter } from "./base-content-formatter";

// Helper function to safely cast song data
function asSong(song: Record<string, unknown>) {
  return song as {
    title?: string;
    author?: { name?: string };
    cover?: boolean;
    lyrics?: string;
    timesPlayed?: number;
    mostCommonYear?: string;
    leastCommonYear?: string;
    longestGapsData?: Record<string, number>;
    history?: string;
    notes?: string;
    featuredLyric?: string;
    yearlyPlayData?: Record<string, number>;
  };
}

export class SongContentFormatter implements ContentFormatter {
  entityType = "song";

  generateDisplayText(song: Record<string, unknown>): string {
    const s = asSong(song);
    let displayText = s.title || "Unknown Song";

    if (s.author?.name) {
      displayText += ` by ${s.author.name}`;
    }

    if (s.cover) {
      displayText += " (Cover)";
    }

    return displayText;
  }

  generateContent(song: Record<string, unknown>): string {
    // Implementation following strategy: "[Song Title] by [Author]. [Lyrics excerpt]. Played [X] times. [Performance context: most/least common years, notable gaps from longestGapsData]. [Tabs/musical info]. [Notes/history]."
    // Emphasize title by repeating it multiple times for better matching

    const s = asSong(song);
    const title = s.title || "Unknown Song";
    let content = `${title}. Song title: ${title}. Track name: ${title}`;

    if (s.author?.name) {
      content += ` by ${s.author.name}`;
    }

    // Add full lyrics
    if (s.lyrics) {
      const cleanLyrics = s.lyrics.replace(/<br\/?>/g, " ").trim();
      if (cleanLyrics) {
        content += `. ${cleanLyrics}`;
      }
    }

    // Add performance statistics
    if (s.timesPlayed !== undefined) {
      content += `. Played ${s.timesPlayed} times`;
    }

    // Add performance context
    const performanceContext = [];
    if (s.mostCommonYear) {
      performanceContext.push(`most common in ${s.mostCommonYear}`);
    }
    if (s.leastCommonYear) {
      performanceContext.push(`least common in ${s.leastCommonYear}`);
    }

    // Add notable gaps from longestGapsData
    if (s.longestGapsData && Object.keys(s.longestGapsData).length > 0) {
      const gaps = Object.entries(s.longestGapsData);
      if (gaps.length > 0) {
        const longestGap = gaps.reduce((max, [period, days]) => (Number(days) > Number(max[1]) ? [period, days] : max));
        performanceContext.push(`longest gap: ${longestGap[1]} days (${longestGap[0]})`);
      }
    }

    if (performanceContext.length > 0) {
      content += `. Performance context: ${performanceContext.join(", ")}`;
    }

    // Add history and notes
    if (s.history) {
      content += `. History: ${s.history}`;
    }

    if (s.notes) {
      content += `. Notes: ${s.notes}`;
    }

    if (s.cover) {
      content += ". This is a cover song";
    }

    // Add featured lyric if available
    if (s.featuredLyric) {
      content += `. Featured lyric: "${s.featuredLyric}"`;
    }

    // Add yearly play data summary for key years
    if (s.yearlyPlayData && Object.keys(s.yearlyPlayData).length > 0) {
      const yearData = Object.entries(s.yearlyPlayData)
        .sort(([, a], [, b]) => Number(b) - Number(a))
        .slice(0, 3); // Top 3 years

      if (yearData.length > 0) {
        const yearSummary = yearData.map(([year, count]) => `${year} (${count}x)`).join(", ");
        content += `. Most active years: ${yearSummary}`;
      }
    }

    return content;
  }
}
