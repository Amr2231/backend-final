const APPOINTMENT_STATUSES = [
  "Scheduled",
  "Checked In",
  "Waiting",
  "In Consultation",
  "Completed",
  "Cancelled",
  "No Show",
];

const BOARD_STATUSES = [
  "Waiting",
  "Checked In",
  "Called",
  "In Consultation",
  "Completed",
];

const PRIORITY_LEVELS = [
  "Emergency",
  "VIP",
  "Pregnant",
  "Senior Citizen",
  "Normal",
];

const PRIORITY_BASE_SCORE = {
  Emergency: 1000,
  VIP: 500,
  Pregnant: 300,
  "Senior Citizen": 200,
  Normal: 0,
};

const DOCTOR_STATUSES = [
  "Available",
  "Busy",
  "In Consultation",
  "Break",
  "On Leave",
];

const CALLBACK_STATUSES = ["Pending", "Contacted", "Closed"];

const VALID_STATUS_TRANSITIONS = {
  Scheduled: ["Checked In", "Waiting", "Cancelled", "No Show"],
  "Checked In": ["Waiting", "In Consultation", "Cancelled"],
  Waiting: ["Called", "In Consultation", "Cancelled", "No Show"],
  "In Consultation": ["Completed", "Waiting"],
  Completed: [],
  Cancelled: [],
  "No Show": [],
};

function computePriorityScore(priorityLevel, checkInAt) {
  const base = PRIORITY_BASE_SCORE[priorityLevel] ?? 0;
  if (!checkInAt) return base;
  const minutesWaiting = Math.max(
    0,
    Math.floor((Date.now() - new Date(checkInAt).getTime()) / 60000),
  );
  return base + minutesWaiting * 2;
}

function priorityReason(priorityLevel, minutesWaiting) {
  const parts = [];
  if (priorityLevel !== "Normal") parts.push(`${priorityLevel} priority`);
  if (minutesWaiting > 0) parts.push(`${minutesWaiting} min waiting`);
  return parts.join(" · ") || "Standard queue order";
}

module.exports = {
  APPOINTMENT_STATUSES,
  BOARD_STATUSES,
  PRIORITY_LEVELS,
  PRIORITY_BASE_SCORE,
  DOCTOR_STATUSES,
  CALLBACK_STATUSES,
  VALID_STATUS_TRANSITIONS,
  computePriorityScore,
  priorityReason,
};
