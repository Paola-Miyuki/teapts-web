export enum ActivityType {
  IndividualSession = 'individual_session',
  GroupSession = 'group_session',
  ParentalGuidance = 'parental_guidance',
  SchoolSupport = 'school_support',
  TeamMeeting = 'team_meeting',
  HomeActivity = 'home_activity',
  Consultation = 'consultation',
  Referral = 'referral',
  Other = 'other',
}

export enum ActivityState {
  Suggested = 'suggested',
  Running = 'running',
  Suspended = 'suspended',
  Concluded = 'concluded',
  Rejected = 'rejected',
  Archived = 'archived',
}

export enum ActivityExecutor {
  Team = 'team',
  Family = 'family',
  School = 'school',
}

export enum ActivityModality {
  InPerson = 'in_person',
  Telehealth = 'telehealth',
  ExternalVisit = 'external_visit',
}

export enum VisitPlace {
  Home = 'home',
  School = 'school',
  Other = 'other',
}

/** Período da frequência, guardado dentro do JSON. */
export enum ActivityPeriod {
  Weekly = 'weekly',
  Biweekly = 'biweekly',
  Monthly = 'monthly',
  OnDemand = 'on_demand',
}
