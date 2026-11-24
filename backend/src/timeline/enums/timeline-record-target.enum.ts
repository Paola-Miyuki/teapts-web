/**
 * Tipo do alvo de um evento da timeline (`timeline_record_target_e`). Eventos
 * de meta e da ficha entram como `pts`.
 */
export enum TimelineRecordTarget {
  Pts = 'pts',
  Activity = 'activity',
  Appointment = 'appointment',
  TeamMember = 'team_member',
  Document = 'document',
}
