// Test IDs for the Traffic Congestion Intelligence Engine dashboard
export const TCIE = {
  // Form
  form: "incident-form",
  addressInput: "address-input",
  causeDropdown: "cause-dropdown",
  priorityToggle: "priority-toggle",
  weatherDropdown: "weather-dropdown",
  todDropdown: "tod-dropdown",
  closureSwitch: "closure-switch",
  weekendSwitch: "weekend-switch",
  submitBtn: "submit-incident-btn",
  clearAllBtn: "clear-all-incidents-btn",

  // Queue
  queue: "incident-queue",
  queueCard: (id) => `queue-card-${id}`,
  markResolvedBtn: (id) => `mark-resolved-btn-${id}`,

  // KPIs
  kpiActive: "kpi-total-active",
  kpiCompound: "kpi-compound-alerts",
  kpiAvgDuration: "kpi-avg-duration",
  kpiOfficers: "kpi-officers-deployed",

  // RL & Map
  rlTerminal: "rl-status-terminal",
  modelPanel: "model-panel",
  map: "mappls-map",
};
