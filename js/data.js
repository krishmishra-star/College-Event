// CampusFlow Data Layer - Single Source of Truth for LocalStorage Data

const KEYS = {
  USERS: "campusflow_users",
  EVENTS: "campusflow_events",
  REGISTRATIONS: "campusflow_registrations",
  FEEDBACK: "campusflow_feedback",
  ANNOUNCEMENTS: "campusflow_announcements",
  BOOKMARKS: "campusflow_bookmarks",
  SESSION: "campusflow_session",
  THEME: "campusflow_theme"
};

// --- Low-Level LocalStorage Helpers ---
function read(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Error reading localStorage key:", key, e);
    return null;
  }
}

function write(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    console.error("Error writing localStorage key:", key, e);
    return false;
  }
}

// --- User Operations ---
export function getUsers() {
  return read(KEYS.USERS) || [];
}

export function saveUsers(users) {
  return write(KEYS.USERS, users);
}

export function getUserByEmail(email) {
  const users = getUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export function getUserById(id) {
  const users = getUsers();
  return users.find(u => u.id === id) || null;
}

export function createUser(name, email, password, role) {
  const users = getUsers();
  if (getUserByEmail(email)) {
    throw new Error("A user with this email already exists.");
  }
  const newUser = {
    id: "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    name,
    email,
    password,
    role
  };
  users.push(newUser);
  saveUsers(users);
  return newUser;
}

// --- Session Operations ---
export function getCurrentUser() {
  return read(KEYS.SESSION) || null;
}

export function setCurrentUser(user) {
  return write(KEYS.SESSION, user);
}

export function logout() {
  localStorage.removeItem(KEYS.SESSION);
}

// --- Theme Operations ---
export function getStoredTheme() {
  return localStorage.getItem(KEYS.THEME) || 'light';
}

export function setStoredTheme(theme) {
  localStorage.setItem(KEYS.THEME, theme);
}

// --- Event Operations ---
export function getEvents() {
  return read(KEYS.EVENTS) || [];
}

export function saveEvents(events) {
  return write(KEYS.EVENTS, events);
}

export function getEventById(id) {
  const events = getEvents();
  return events.find(e => e.id === id) || null;
}

export function createEvent(eventData) {
  const events = getEvents();
  const newEvent = {
    id: "event_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    ...eventData,
    maxParticipants: parseInt(eventData.maxParticipants) || 100,
    availableSeats: parseInt(eventData.maxParticipants) || 100,
    certificatesAvailable: eventData.certificatesAvailable === true || eventData.certificatesAvailable === 'true'
  };
  events.push(newEvent);
  saveEvents(events);
  return newEvent;
}

export function updateEvent(eventId, updatedFields) {
  const events = getEvents();
  const index = events.findIndex(e => e.id === eventId);
  if (index === -1) throw new Error("Event not found.");
  
  const currentEvent = events[index];
  
  // Calculate new available seats if maxParticipants changed
  let availableSeats = currentEvent.availableSeats;
  if (updatedFields.maxParticipants !== undefined) {
    const newMax = parseInt(updatedFields.maxParticipants) || 0;
    const diff = newMax - currentEvent.maxParticipants;
    availableSeats = Math.max(0, currentEvent.availableSeats + diff);
  }

  events[index] = {
    ...currentEvent,
    ...updatedFields,
    availableSeats,
    maxParticipants: updatedFields.maxParticipants !== undefined ? parseInt(updatedFields.maxParticipants) : currentEvent.maxParticipants,
    certificatesAvailable: updatedFields.certificatesAvailable !== undefined ? (updatedFields.certificatesAvailable === true || updatedFields.certificatesAvailable === 'true') : currentEvent.certificatesAvailable
  };

  saveEvents(events);
  return events[index];
}

export function deleteEvent(eventId) {
  let events = getEvents();
  events = events.filter(e => e.id !== eventId);
  saveEvents(events);

  // Clean up registrations, feedback, and announcements for this event
  let regs = getRegistrations();
  regs = regs.filter(r => r.eventId !== eventId);
  saveRegistrations(regs);

  let feed = getFeedback();
  feed = feed.filter(f => f.eventId !== eventId);
  saveFeedback(feed);

  let ann = getAnnouncements();
  ann = ann.filter(a => a.eventId !== eventId);
  saveAnnouncements(ann);
}

// --- Registration Operations ---
export function getRegistrations() {
  return read(KEYS.REGISTRATIONS) || [];
}

export function saveRegistrations(registrations) {
  return write(KEYS.REGISTRATIONS, registrations);
}

export function getRegistrationsByUser(userId) {
  const regs = getRegistrations();
  return regs.filter(r => r.userId === userId);
}

export function getRegistrationsByEvent(eventId) {
  const regs = getRegistrations();
  return regs.filter(r => r.eventId === eventId);
}

export function registerForEvent(eventId, userId) {
  const events = getEvents();
  const eventIndex = events.findIndex(e => e.id === eventId);
  if (eventIndex === -1) throw new Error("Event does not exist.");

  const event = events[eventIndex];
  if (event.availableSeats <= 0) {
    throw new Error("No seats available for this event.");
  }

  // Check registration deadline
  const deadline = new Date(event.registrationDeadline + 'T23:59:59');
  const now = new Date();
  if (now > deadline) {
    throw new Error("Registration deadline has passed.");
  }

  const regs = getRegistrations();
  const duplicate = regs.find(r => r.eventId === eventId && r.userId === userId && r.status === "registered");
  if (duplicate) {
    throw new Error("You are already registered for this event.");
  }

  // Find if there is an inactive/cancelled registration we can re-activate, or create new
  let reg = regs.find(r => r.eventId === eventId && r.userId === userId);
  if (reg) {
    reg.status = "registered";
    reg.registeredAt = new Date().toISOString();
  } else {
    // Generate a code CF-XXXX
    const code = "CF-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    reg = {
      id: "reg_" + Date.now(),
      eventId,
      userId,
      registrationCode: code,
      status: "registered",
      checkedIn: false,
      registeredAt: new Date().toISOString()
    };
    regs.push(reg);
  }

  // Decrement seats
  event.availableSeats -= 1;
  saveEvents(events);
  saveRegistrations(regs);

  return reg;
}

export function cancelRegistration(registrationId) {
  const regs = getRegistrations();
  const reg = regs.find(r => r.id === registrationId);
  if (!reg) throw new Error("Registration not found.");
  if (reg.status === "cancelled") return reg;

  reg.status = "cancelled";

  // Re-increment event seats
  const events = getEvents();
  const event = events.find(e => e.id === reg.eventId);
  if (event) {
    event.availableSeats = Math.min(event.maxParticipants, event.availableSeats + 1);
    saveEvents(events);
  }

  saveRegistrations(regs);
  return reg;
}

export function checkInParticipant(code) {
  const regs = getRegistrations();
  const cleanCode = code.toUpperCase().trim();
  const reg = regs.find(r => r.registrationCode.toUpperCase() === cleanCode && r.status === "registered");
  if (!reg) throw new Error("Invalid or inactive registration code.");
  if (reg.checkedIn) throw new Error("Participant has already checked in.");

  reg.checkedIn = true;
  reg.checkedInAt = new Date().toISOString();
  saveRegistrations(regs);
  return reg;
}

export function undoCheckIn(registrationId) {
  const regs = getRegistrations();
  const reg = regs.find(r => r.id === registrationId);
  if (!reg) throw new Error("Registration not found.");
  reg.checkedIn = false;
  delete reg.checkedInAt;
  saveRegistrations(regs);
  return reg;
}

// --- Bookmarks Operations ---
export function getBookmarks() {
  return read(KEYS.BOOKMARKS) || [];
}

export function isBookmarked(eventId) {
  const bookmarks = getBookmarks();
  return bookmarks.includes(eventId);
}

export function toggleBookmark(eventId) {
  let bookmarks = getBookmarks();
  const index = bookmarks.indexOf(eventId);
  let isSaved = false;
  if (index > -1) {
    bookmarks.splice(index, 1);
    isSaved = false;
  } else {
    bookmarks.push(eventId);
    isSaved = true;
  }
  write(KEYS.BOOKMARKS, bookmarks);
  return isSaved;
}

// --- Feedback Operations ---
export function getFeedback() {
  return read(KEYS.FEEDBACK) || [];
}

export function saveFeedback(feedbackList) {
  return write(KEYS.FEEDBACK, feedbackList);
}

export function getFeedbackByEvent(eventId) {
  const feedback = getFeedback();
  return feedback.filter(f => f.eventId === eventId);
}

export function addFeedback(eventId, userId, rating, organizationRating, venueRating, suggestions) {
  const feedback = getFeedback();
  const duplicate = feedback.find(f => f.eventId === eventId && f.userId === userId);
  if (duplicate) {
    throw new Error("Feedback has already been submitted for this event.");
  }

  const newFeedback = {
    id: "feed_" + Date.now(),
    eventId,
    userId,
    rating: parseInt(rating),
    organizationRating: parseInt(organizationRating),
    venueRating: parseInt(venueRating),
    suggestions,
    createdAt: new Date().toISOString()
  };

  feedback.push(newFeedback);
  saveFeedback(feedback);
  return newFeedback;
}

// --- Announcement Operations ---
export function getAnnouncements() {
  return read(KEYS.ANNOUNCEMENTS) || [];
}

export function saveAnnouncements(announcements) {
  return write(KEYS.ANNOUNCEMENTS, announcements);
}

export function getAnnouncementsByEvent(eventId) {
  const ann = getAnnouncements();
  return ann.filter(a => a.eventId === eventId);
}

export function addAnnouncement(eventId, message) {
  const ann = getAnnouncements();
  const newAnn = {
    id: "ann_" + Date.now(),
    eventId,
    message,
    createdAt: new Date().toISOString()
  };
  ann.push(newAnn);
  saveAnnouncements(ann);
  return newAnn;
}

// --- CSV Export Helper ---
export function exportRegistrationsToCSV(eventId) {
  const event = getEventById(eventId);
  if (!event) throw new Error("Event not found.");

  const regs = getRegistrationsByEvent(eventId).filter(r => r.status === 'registered');
  const users = getUsers();

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Registration Code,Participant Name,Email,Registration Date,Attendance Status\n";

  regs.forEach(r => {
    const user = users.find(u => u.id === r.userId) || { name: "Unknown", email: "N/A" };
    const dateStr = new Date(r.registeredAt).toLocaleString();
    const status = r.checkedIn ? "Checked In" : "Registered (Pending Check-in)";
    
    // Escape commas
    const name = `"${user.name.replace(/"/g, '""')}"`;
    const email = `"${user.email.replace(/"/g, '""')}"`;
    csvContent += `${r.registrationCode},${name},${email},"${dateStr}","${status}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `CampusFlow_${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_Attendees.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- iCalendar (.ics) Export Helper ---
export function downloadICS(event) {
  if (!event) return;
  
  const formatDate = (dateStr, timeStr) => {
    const d = new Date(`${dateStr}T${timeStr || '09:00'}:00`);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const dtStart = formatDate(event.date, event.time);
  // Default 2 hour duration
  const endD = new Date(`${event.date}T${event.time || '09:00'}:00`);
  endD.setHours(endD.getHours() + 2);
  const dtEnd = endD.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CampusFlow//College Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event_${event.id}@campusflow.edu`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${event.venue || 'Campus'}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  const icsData = icsLines.join("\r\n");
  const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Database Seeding ---
export function seedDatabase(force = false) {
  if (!force && read(KEYS.USERS) && read(KEYS.EVENTS)) {
    // Database already exists
    return;
  }

  // 1. Seed Users
  const demoUsers = [
    {
      id: "user_student",
      name: "Alex Student",
      email: "student@campusflow.edu",
      password: "password",
      role: "student"
    },
    {
      id: "user_organizer",
      name: "Sarah Organizer",
      email: "organizer@campusflow.edu",
      password: "password",
      role: "organizer"
    },
    {
      id: "user_volunteer",
      name: "Vicky Volunteer",
      email: "volunteer@campusflow.edu",
      password: "password",
      role: "volunteer"
    }
  ];
  write(KEYS.USERS, demoUsers);

  // 2. Seed Events (A mix of future, sold out, and past events)
  const demoEvents = [
    {
      id: "event_1",
      title: "Tech Hackfest 2026",
      description: "Collaborate, create, and build next-generation applications in 24 hours. Compete with teams from other campuses.",
      category: "Technical",
      date: "2026-09-10",
      time: "09:00",
      venue: "Main Seminar Hall",
      organizer: "Sarah Organizer",
      maxParticipants: 100,
      availableSeats: 98,
      registrationDeadline: "2026-09-08",
      rules: "Bring laptops and college ID card. Teams can have up to 4 members.",
      contact: "hack@campusflow.edu",
      imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800",
      certificatesAvailable: true
    },
    {
      id: "event_2",
      title: "Cultural Night & Dance Festival",
      description: "An evening of vibrant musical acts, dances, and theatrical displays. Showcasing local talent.",
      category: "Cultural",
      date: "2026-09-15",
      time: "18:00",
      venue: "Open Air Theatre",
      organizer: "Sarah Organizer",
      maxParticipants: 500,
      availableSeats: 499,
      registrationDeadline: "2026-09-14",
      rules: "Entry pass must be collected. ID card is mandatory for safety.",
      contact: "cult@campusflow.edu",
      imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
      certificatesAvailable: false
    },
    {
      id: "event_3",
      title: "Inter-College Basketball Cup",
      description: "Annual basketball tournament featuring the top 16 regional college teams in a standard knockout format.",
      category: "Sports",
      date: "2026-09-20",
      time: "08:00",
      venue: "Sports Arena Complex",
      organizer: "Sarah Organizer",
      maxParticipants: 50,
      availableSeats: 48,
      registrationDeadline: "2026-09-18",
      rules: "Proper sports gear and college jersey mandatory.",
      contact: "sports@campusflow.edu",
      imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
      certificatesAvailable: true
    },
    {
      id: "event_4",
      title: "AI and Robotics Workshop",
      description: "Hands-on masterclass in building micro-controllers and training neural networks for pathfinding.",
      category: "Technical",
      date: "2026-09-22",
      time: "10:00",
      venue: "Lab 3, CS Block",
      organizer: "Sarah Organizer",
      maxParticipants: 30,
      availableSeats: 0,
      registrationDeadline: "2026-09-21",
      rules: "Basic python programming required. Hardware provided.",
      contact: "ai@campusflow.edu",
      imageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800",
      certificatesAvailable: true
    },
    {
      id: "event_5",
      title: "UI/UX Design Bootcamp",
      description: "Learn how to conduct user research, build wireframes, and design sleek prototypes in Figma.",
      category: "Technical",
      date: "2026-10-02",
      time: "11:00",
      venue: "Design Studio Room 204",
      organizer: "Sarah Organizer",
      maxParticipants: 40,
      availableSeats: 39,
      registrationDeadline: "2026-10-01",
      rules: "Install Figma desktop app. Keep a digital journal.",
      contact: "design@campusflow.edu",
      imageUrl: "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=800",
      certificatesAvailable: true
    },
    {
      id: "event_6",
      title: "College Band Battle",
      description: "Rock bands from diverse departments clash for the ultimate title. Judged by famous local musicians.",
      category: "Cultural",
      date: "2026-09-28",
      time: "17:00",
      venue: "Main Auditorium",
      organizer: "Sarah Organizer",
      maxParticipants: 200,
      availableSeats: 200,
      registrationDeadline: "2026-09-25",
      rules: "Acoustic and electronic instruments allowed. 15-minute slot.",
      contact: "bands@campusflow.edu",
      imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800",
      certificatesAvailable: false
    },
    {
      id: "event_7",
      title: "Annual Debate Championship",
      description: "Speak up on controversial topics and display your logical reasoning and oratory skills.",
      category: "Cultural",
      date: "2026-08-25",
      time: "14:00",
      venue: "Conference Hall B",
      organizer: "Sarah Organizer",
      maxParticipants: 60,
      availableSeats: 57,
      registrationDeadline: "2026-08-24",
      rules: "Topic will be assigned 10 minutes prior to the stage presentation.",
      contact: "debate@campusflow.edu",
      imageUrl: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800",
      certificatesAvailable: true
    },
    {
      id: "event_8",
      title: "Chess Grandmaster Arena",
      description: "A fast-paced blitz chess tournament under international clock timers. Open to all students.",
      category: "Sports",
      date: "2026-08-28",
      time: "10:00",
      venue: "Library Reading Room",
      organizer: "Sarah Organizer",
      maxParticipants: 32,
      availableSeats: 30,
      registrationDeadline: "2026-08-27",
      rules: "Standard chess clock 5m + 3s increment. FIDE guidelines apply.",
      contact: "chess@campusflow.edu",
      imageUrl: "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800",
      certificatesAvailable: true
    }
  ];
  write(KEYS.EVENTS, demoEvents);

  // 3. Seed Registrations
  const demoRegs = [
    {
      id: "reg_seeded_1",
      eventId: "event_1",
      userId: "user_student",
      registrationCode: "CF-TECH",
      status: "registered",
      checkedIn: false,
      registeredAt: "2026-08-29T10:00:00.000Z"
    },
    {
      id: "reg_seeded_2",
      eventId: "event_3",
      userId: "user_student",
      registrationCode: "CF-PLAY",
      status: "registered",
      checkedIn: false,
      registeredAt: "2026-08-30T14:30:00.000Z"
    },
    {
      id: "reg_seeded_3",
      eventId: "event_7",
      userId: "user_student",
      registrationCode: "CF-TALK",
      status: "registered",
      checkedIn: true,
      registeredAt: "2026-08-24T09:00:00.000Z"
    },
    {
      id: "reg_seeded_4",
      eventId: "event_8",
      userId: "user_student",
      registrationCode: "CF-MATE",
      status: "registered",
      checkedIn: false,
      registeredAt: "2026-08-26T12:00:00.000Z"
    },
    {
      id: "reg_seeded_5",
      eventId: "event_1",
      userId: "user_dummy_1",
      registrationCode: "CF-ABCD",
      status: "registered",
      checkedIn: false,
      registeredAt: "2026-08-29T11:00:00.000Z"
    },
    {
      id: "reg_seeded_6",
      eventId: "event_2",
      userId: "user_dummy_1",
      registrationCode: "CF-CULT",
      status: "registered",
      checkedIn: false,
      registeredAt: "2026-08-29T11:30:00.000Z"
    },
    {
      id: "reg_seeded_7",
      eventId: "event_3",
      userId: "user_dummy_2",
      registrationCode: "CF-SPRT",
      status: "registered",
      checkedIn: false,
      registeredAt: "2026-08-30T10:00:00.000Z"
    },
    {
      id: "reg_seeded_8",
      eventId: "event_7",
      userId: "user_dummy_2",
      registrationCode: "CF-DUMY",
      status: "registered",
      checkedIn: true,
      registeredAt: "2026-08-24T10:00:00.000Z"
    },
    {
      id: "reg_seeded_9",
      eventId: "event_7",
      userId: "user_dummy_1",
      registrationCode: "CF-DUMZ",
      status: "registered",
      checkedIn: true,
      registeredAt: "2026-08-24T10:30:00.000Z"
    }
  ];
  write(KEYS.REGISTRATIONS, demoRegs);

  // 4. Seed Feedback
  const demoFeedback = [
    {
      id: "feed_seeded_1",
      eventId: "event_7",
      userId: "user_dummy_1",
      rating: 5,
      organizationRating: 5,
      venueRating: 4,
      suggestions: "Excellent event, started right on time!",
      createdAt: "2026-08-26T10:00:00.000Z"
    },
    {
      id: "feed_seeded_2",
      eventId: "event_7",
      userId: "user_dummy_2",
      rating: 4,
      organizationRating: 4,
      venueRating: 4,
      suggestions: "The mic setup could be improved, but speakers were great.",
      createdAt: "2026-08-26T12:00:00.000Z"
    }
  ];
  write(KEYS.FEEDBACK, demoFeedback);

  // 5. Seed Announcements
  const demoAnnouncements = [
    {
      id: "ann_seeded_1",
      eventId: "event_1",
      message: "The rules sheet for Hackfest has been updated. Please check the github repo linked under contact.",
      createdAt: "2026-08-30T10:00:00.000Z"
    },
    {
      id: "ann_seeded_2",
      eventId: "event_3",
      message: "Tournament matches will start at 08:30 AM instead of 08:00 AM due to court maintenance. Please report accordingly.",
      createdAt: "2026-08-31T08:00:00.000Z"
    }
  ];
  write(KEYS.ANNOUNCEMENTS, demoAnnouncements);

  // 6. Seed Bookmarks
  const demoBookmarks = ["event_1", "event_4"];
  write(KEYS.BOOKMARKS, demoBookmarks);

  console.log("CampusFlow Database Seeded Successfully!");
}

// Auto-seed on load
seedDatabase();
