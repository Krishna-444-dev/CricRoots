// shared/utils/formatters.ts
// Shared utility functions for formatting data in both web and mobile applications

/**
 * Formats a date string to a human-readable format
 * @param dateString ISO date string
 * @param format Optional format specification
 * @returns Formatted date string
 */
export function formatDate(dateString: string, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const date = new Date(dateString);
  
  switch (format) {
    case 'short':
      return date.toLocaleDateString();
    case 'long':
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'medium':
    default:
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
  }
}

/**
 * Formats a currency value
 * @param amount Amount to format
 * @param currency Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency
  }).format(amount);
}

/**
 * Formats a cricket score (e.g., "186/4")
 * @param runs Total runs
 * @param wickets Total wickets
 * @returns Formatted score string
 */
export function formatScore(runs: number, wickets: number): string {
  return `${runs}/${wickets}`;
}

/**
 * Formats overs and balls into a cricket-standard format
 * @param overs Number of complete overs
 * @param balls Number of balls in current over
 * @returns Formatted overs string (e.g., "4.2" for 4 overs and 2 balls)
 */
export function formatOvers(overs: number, balls: number): string {
  return `${overs}.${balls}`;
}

/**
 * Formats a player's name for display
 * @param firstName First name
 * @param lastName Last name
 * @param format Format specification
 * @returns Formatted player name
 */
export function formatPlayerName(
  firstName: string, 
  lastName: string, 
  format: 'full' | 'initial' | 'last' = 'full'
): string {
  switch (format) {
    case 'initial':
      return `${firstName.charAt(0)}. ${lastName}`;
    case 'last':
      return lastName;
    case 'full':
    default:
      return `${firstName} ${lastName}`;
  }
}

/**
 * Truncates text to a specified length with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Formats a phone number for display
 * @param phoneNumber Raw phone number
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Simple formatting for US numbers, would need to be expanded for international
  if (phoneNumber.length === 10) {
    return `(${phoneNumber.substring(0, 3)}) ${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6)}`;
  }
  return phoneNumber;
}

/**
 * Calculates cricket statistics
 * @param runs Total runs
 * @param balls Total balls faced
 * @returns Object with calculated statistics
 */
export function calculateBattingStats(runs: number, balls: number): { strikeRate: number, average?: number } {
  const strikeRate = balls > 0 ? (runs / balls) * 100 : 0;
  return {
    strikeRate: parseFloat(strikeRate.toFixed(2))
  };
}

/**
 * Calculates bowling statistics
 * @param runs Runs conceded
 * @param wickets Wickets taken
 * @param balls Balls bowled
 * @returns Object with calculated statistics
 */
export function calculateBowlingStats(runs: number, wickets: number, balls: number): { 
  economy: number, 
  average: number, 
  strikeRate: number 
} {
  const overs = Math.floor(balls / 6) + (balls % 6) / 10;
  const economy = overs > 0 ? runs / overs : 0;
  const average = wickets > 0 ? runs / wickets : 0;
  const strikeRate = wickets > 0 ? balls / wickets : 0;
  
  return {
    economy: parseFloat(economy.toFixed(2)),
    average: parseFloat(average.toFixed(2)),
    strikeRate: parseFloat(strikeRate.toFixed(2))
  };
}

/**
 * Formats a time duration in a human-readable way
 * @param minutes Duration in minutes
 * @returns Formatted duration string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  
  return `${hours} hr ${remainingMinutes} min`;
}

/**
 * Generates initials from a name
 * @param name Full name
 * @param maxLength Maximum number of initials to return
 * @returns Initials string
 */
export function getInitials(name: string, maxLength: number = 2): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, maxLength);
}
