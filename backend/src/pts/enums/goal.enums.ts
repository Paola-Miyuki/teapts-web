export enum GoalTerm {
  Short = 'short',
  Medium = 'medium',
  Long = 'long',
}

export enum GoalArea {
  Communication = 'communication',
  Social = 'social',
  Cognitive = 'cognitive',
  MotorSensory = 'motor_sensory',
}

export enum GoalStatus {
  InProgress = 'in_progress',
  Achieved = 'achieved',
  PartiallyAchieved = 'partially_achieved',
  NotAchieved = 'not_achieved',
}

export enum GoalOrigin {
  New = 'new',
  KeptPartial = 'kept_partial',
  KeptNotAchieved = 'kept_not_achieved',
}
