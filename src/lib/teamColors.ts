export const TEAM_COLORS: Record<string, string> = {
  'McLaren':          '#FF8000',
  'Mercedes':         '#00D2BE',
  'Ferrari':          '#E8002D',
  'Red Bull Racing':  '#3671C6',
  'Alpine':           '#FF87BC',
  'Racing Bulls':     '#6692FF',
  'Haas':             '#B6BABD',
  'Williams':         '#37BEDD',
  'Audi':             '#BB0000',
  'Aston Martin':     '#229971',
}

export function getTeamColor(team: string): string {
  return TEAM_COLORS[team] ?? '#6B7280'
}
