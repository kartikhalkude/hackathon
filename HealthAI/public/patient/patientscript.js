let currentPatientName = "";

document.addEventListener("DOMContentLoaded", () => {
  if (!sessionStorage.getItem("token")) {
    window.location.href = "/index.html";
    return;
  }
  loadPatientInfo();
  loadPrescriptions();
});

async function loadPatientInfo() {
  try {
    const response = await fetch("/api/patient/info", {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch patient info");

    const data = await response.json();

    if (data && data.name) {
      currentPatientName = data.name;
      document.getElementById("patientName").textContent = data.name;
      document.getElementById("patientFullName").value = data.name;
      if (data.age) {
        document.getElementById("patientAge").value = data.age;
      }
    }
  } catch (error) {
    console.error("Error loading patient info:", error);
    document.getElementById("patientName").textContent = "Guest User";
  }
}

async function analyzeSymptoms() {
  const formData = {
    name:
      document.getElementById("patientFullName").value || currentPatientName,
    age: document.getElementById("patientAge").value,
    language: document.getElementById("prescriptionLanguage").value,
    symptoms: document.getElementById("symptoms").value,
    duration: document.getElementById("duration").value,
    severity: document.getElementById("severity").value,
  };

  if (
    !formData.name ||
    !formData.age ||
    !formData.symptoms ||
    !formData.duration ||
    !formData.severity
  ) {
    alert("Please fill in all required fields before analyzing.");
    return;
  }

  // Show loading animation
  const loadingAnimation = document.getElementById("aiLoadingAnimation");
  loadingAnimation.style.display = "flex";

  const medicalPrompt = `
            Patient Name: ${formData.name}
            Age: ${formData.age}
            Symptoms: ${formData.symptoms}
            Duration: ${formData.duration}
            Severity: ${formData.severity}/10
            Preferred Language: ${formData.language}

            Provide the following in HTML format inside a <div> Dont add start html and bold the following:
            - Patient details
            - Diagnosis
            - Dos and Don'ts for the condition
            - Suggest 1-2 commonly used medicines

            Ensure it is formatted properly in ${formData.language}.
        `;

  try {
    const response = await puter.ai.chat(medicalPrompt);
    const aiDiagnosisBox = document.getElementById("aiDiagnosisBox");
    aiDiagnosisBox.innerHTML = response;
    aiDiagnosisBox.classList.remove("hidden");
    document.getElementById("submitSymptomsBtn").classList.remove("hidden");
    sessionStorage.setItem("aiDiagnosis", response);
  } catch (error) {
    console.error("AI Analysis Error:", error);
    alert("Failed to analyze symptoms. Please try again.");
  } finally {
    // Hide loading animation
    loadingAnimation.style.display = "none";
  }
}
document.getElementById("symptomForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const selectedDoctor = document.getElementById("doctorSelect").value;
  if (!selectedDoctor) {
    alert("Please select a doctor");
    return;
  }

  const formData = {
    symptoms: document.getElementById("symptoms").value,
    duration: document.getElementById("duration").value,
    severity: parseInt(document.getElementById("severity").value),
    aiDiagnosis: sessionStorage.getItem("aiDiagnosis"),
    doctorId: selectedDoctor, // Add the selected doctor's ID
  };

  try {
    const response = await fetch("/api/prescriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (response.ok) {
      alert("Prescription request sent successfully!");
      sessionStorage.removeItem("aiDiagnosis");
      e.target.reset();
      document.getElementById("aiDiagnosisBox").classList.add("hidden");
      document.getElementById("submitSymptomsBtn").classList.add("hidden");
      document.getElementById("doctorInfo").classList.add("hidden");
      loadPrescriptions();
    } else {
      throw new Error(data.error || "Failed to submit prescription request");
    }
  } catch (error) {
    console.error("Submission Error:", error);
    alert(error.message);
  }
});
async function loadPrescriptions() {
  try {
    const response = await fetch("/api/prescriptions", {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to load prescriptions");

    const prescriptions = await response.json();
    displayPrescriptions(prescriptions);
  } catch (error) {
    console.error("Error loading prescriptions:", error);
    document.getElementById("prescriptionsList").innerHTML =
      '<p class="text-gray-600 text-center py-8">Failed to load prescriptions</p>';
  }
}
function displayPrescriptions(prescriptions) {
  const container = document.getElementById("prescriptionsList");

  if (!prescriptions || prescriptions.length === 0) {
    container.innerHTML =
      '<p class="text-gray-600 text-center py-8">No prescriptions available</p>';
    return;
  }

  container.innerHTML = prescriptions
    .map(
      (prescription) => `
        <div class="border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow bg-white" data-prescription-id="${
          prescription._id
        }">
            <div class="space-y-3">
                <div class="bg-blue-50 p-3 rounded-lg">
                    <div class="font-bold text-gray-900">Patient: ${currentPatientName}</div>
                    <div class="text-sm text-gray-600">Doctor: ${
                      prescription.doctorId?.name || "Pending Assignment"
                    }</div>
                </div>
                
                <div class="text-sm text-gray-500 mb-2">
                    Created: ${new Date(
                      prescription.createdAt
                    ).toLocaleString()}
                </div>
                
                <div class="flex items-center justify-between mt-4">
                    <div class="text-sm font-medium ${getStatusColor(
                      prescription.status
                    )}">
                        Status: ${
                          prescription.status.charAt(0).toUpperCase() +
                          prescription.status.slice(1)
                        }
                    </div>
                    <div class="flex gap-2">
                        <button 
                            onclick="showPrescriptionDetails('${
                              prescription._id
                            }')" 
                            class="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors duration-200">
                            View Details
                        </button>
                        ${
                          prescription.status === "pending"
                            ? `<button 
                                onclick="deletePrescription('${prescription._id}')"
                                class="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors duration-200">
                                Delete
                            </button>`
                            : ""
                        }
                    </div>
                </div>
            </div>
        </div>
    `
    )
    .join("");
}

async function showPrescriptionDetails(prescriptionId) {
  try {
    const response = await fetch(`/api/prescriptions/${prescriptionId}`, {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch prescription details");

    const prescription = await response.json();

    const detailsHTML = `
            <div class="prescription-details">
                <h2 class="text-xl font-bold mb-4">Prescription Details</h2>
                <div class="space-y-2">
                    <p><strong>Patient:</strong> ${
                      prescription.patientId?.name || "Unassigned"
                    }</p>
                    <p><strong>Doctor:</strong> ${
                      prescription.doctorId?.name || "Unassigned"
                    }</p>
                    <p><strong>Created:</strong> ${new Date(
                      prescription.createdAt
                    ).toLocaleString()}</p>
                    
                    <div class="mt-4">
                        <strong>AI Diagnosis:</strong>
                        <p class="text-gray-700">${
                          prescription.aiDiagnosis || "No AI Analysis Available"
                        }</p>
                    </div>
                    
                    ${
                      prescription.medications &&
                      prescription.medications.length > 0
                        ? `<h3 class="mt-4 font-semibold">Medications:</h3>
                           <ul class="list-disc pl-5">
                               ${prescription.medications
                                 .map(
                                   (med) =>
                                     `<li>${med.name} - ${med.dosage} (${med.frequency})</li>`
                                 )
                                 .join("")}
                           </ul>`
                        : "<p>No medications prescribed</p>"
                    }
                    
                    ${
                      prescription.doctorNotes
                        ? `<h3 class="mt-4 font-semibold">Doctor's Notes:</h3>
                           <p>${prescription.doctorNotes}</p>`
                        : ""
                    }
                </div>
            </div>
        `;

    openModal(detailsHTML);
  } catch (error) {
    console.error("Error fetching prescription details:", error);
    alert("Failed to load prescription details");
  }
}
function openModal(content) {
  const modal = document.getElementById("prescriptionModal");
  const modalContent = document.getElementById("modalContent");

  // Set content
  modalContent.innerHTML = content;

  // Show modal
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeModal() {
  const modal = document.getElementById("prescriptionModal");

  // Hide modal
  modal.classList.remove("flex");
  modal.classList.add("hidden");
}

// Event Listeners for Modal
document.addEventListener("DOMContentLoaded", () => {
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modal = document.getElementById("prescriptionModal");

  // Close modal when close button clicked
  closeModalBtn.addEventListener("click", closeModal);

  // Close modal when clicking outside the modal content
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  // Close modal with Escape key
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });
});

function getStatusColor(status) {
  const colors = {
    pending: "text-yellow-600",
    approved: "text-green-600",
    rejected: "text-red-600",
  };
  return colors[status.toLowerCase()] || "text-gray-600";
}

async function deletePrescription(prescriptionId) {
  if (!confirm("Are you sure you want to delete this prescription request?"))
    return;

  try {
    const response = await fetch(`/api/prescriptions/${prescriptionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to delete prescription");
    }

    alert("Prescription request deleted successfully");
    await loadPrescriptions();
  } catch (error) {
    console.error("Error deleting prescription:", error);
    alert(error.message);
  }
}

function downloadPrescription(prescriptionId) {
  // Note: This is a placeholder for future implementation
  // Could use libraries like jsPDF to generate downloadable prescriptions
  alert("Download feature coming soon!");
}

function logout() {
  sessionStorage.removeItem("token");
  window.location.href = "/index.html";
}
// Add these functions to your existing JavaScript
async function loadDoctors() {
  try {
    const response = await fetch("/api/doctors", {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch doctors");

    const doctors = await response.json();
    const doctorSelect = document.getElementById("doctorSelect");

    doctors.forEach((doctor) => {
      const option = document.createElement("option");
      option.value = doctor._id;
      option.textContent = `Dr. ${doctor.name} (${doctor.specialization})`;
      option.dataset.specialization = doctor.specialization;
      doctorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading doctors:", error);
    alert("Failed to load available doctors");
  }
}

// Add doctor selection change handler
document.getElementById("doctorSelect").addEventListener("change", (e) => {
  const doctorInfo = document.getElementById("doctorInfo");
  const doctorSpecialization = document.getElementById("doctorSpecialization");

  if (e.target.value) {
    const selectedOption = e.target.options[e.target.selectedIndex];
    doctorSpecialization.textContent = selectedOption.dataset.specialization;
    doctorInfo.classList.remove("hidden");
  } else {
    doctorInfo.classList.add("hidden");
  }
});

// Modify the existing submit handler

// Call loadDoctors when the page loads
document.addEventListener("DOMContentLoaded", () => {
  if (!sessionStorage.getItem("token")) {
    window.location.href = "/index.html";
    return;
  }
  loadPatientInfo();
  loadDoctors();
  loadPrescriptions();
});

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("appointmentDate").min = today;
  loadAppointments();
});

// Load doctors into the appointment doctor select
async function loadAppointmentDoctors() {
  try {
    const response = await fetch("/api/doctors", {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch doctors");

    const doctors = await response.json();
    const doctorSelect = document.getElementById("appointmentDoctorSelect");

    doctorSelect.innerHTML = '<option value="">Choose a doctor...</option>';
    doctors.forEach((doctor) => {
      const option = document.createElement("option");
      option.value = doctor._id;
      option.textContent = `Dr. ${doctor.name} (${doctor.specialization})`;
      doctorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading doctors:", error);
    alert("Failed to load available doctors");
  }
}

// Handle appointment form submission
document
  .getElementById("appointmentForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = {
      doctorId: document.getElementById("appointmentDoctorSelect").value,
      date: document.getElementById("appointmentDate").value,
      time: document.getElementById("appointmentTime").value,
      notes: document.getElementById("appointmentNotes").value,
    };

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Appointment booked successfully!");
        e.target.reset();
        loadAppointments();
      } else {
        throw new Error(data.error || "Failed to book appointment");
      }
    } catch (error) {
      console.error("Error booking appointment:", error);
      alert(error.message);
    }
  });

// Load and display appointments
async function loadAppointments() {
  try {
    const response = await fetch("/api/patient/appointments", {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch appointments");

    const appointments = await response.json();
    displayAppointments(appointments);
  } catch (error) {
    console.error("Error loading appointments:", error);
    document.getElementById("appointmentsList").innerHTML =
      '<p class="text-gray-600">Failed to load appointments</p>';
  }
}

// Display appointments in the list
function displayAppointments(appointments) {
  const container = document.getElementById("appointmentsList");

  if (!appointments || appointments.length === 0) {
    container.innerHTML =
      '<p class="text-gray-600">No appointments scheduled</p>';
    return;
  }

  container.innerHTML = appointments
    .map(
      (appointment) => `
            <div class="border rounded-lg p-4 bg-gray-50">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-semibold">Dr. ${
                          appointment.doctor.name
                        }</p>
                        <p class="text-sm text-gray-600">${
                          appointment.doctor.specialization
                        }</p>
                        <p class="text-sm mt-2">
                            ${new Date(
                              appointment.date
                            ).toLocaleDateString()} at ${appointment.time}
                        </p>
                        ${
                          appointment.notes
                            ? `<p class="text-sm text-gray-600 mt-2">Notes: ${appointment.notes}</p>`
                            : ""
                        }
                    </div>
                    <span class="px-3 py-1 rounded-full text-sm ${getStatusColor(
                      appointment.status
                    )}">
                        ${
                          appointment.status.charAt(0).toUpperCase() +
                          appointment.status.slice(1)
                        }
                    </span>
                </div>
            </div>
        `
    )
    .join("");
}

// Helper function to get status color classes
function getStatusColor(status) {
  const colors = {
    scheduled: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

// Add loadAppointmentDoctors to the existing DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", () => {
  if (!sessionStorage.getItem("token")) {
    window.location.href = "/index.html";
    return;
  }
  loadPatientInfo();
  loadPrescriptions();
  loadDoctors();
  loadAppointmentDoctors(); // Add this line
  loadAppointments(); // Add this line
});

async function loadHealthTimeline() {
  try {
    const response = await fetch("/api/patient/health-timeline", {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch health timeline");
    const timelineData = await response.json();
    displayHealthTimeline(timelineData);
  } catch (error) {
    console.error("Error loading health timeline:", error);
  }
}

function displayHealthTimeline(timelineData) {
  const container = document.getElementById("healthTimeline");
  const timelineHTML = timelineData.map(entry => `
    <div class="timeline-item flex">
      <div class="timeline-marker w-4 h-4 rounded-full ${getTimelineMarkerColor(entry.type)}"></div>
      <div class="timeline-content ml-4 mb-6">
        <div class="date text-sm text-gray-600">${new Date(entry.date).toLocaleDateString()}</div>
        <div class="title font-bold">${entry.title}</div>
        <div class="description text-gray-700">${entry.description}</div>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = timelineHTML;
}

function getTimelineMarkerColor(type) {
  const colors = {
    prescription: 'bg-blue-500',
    appointment: 'bg-green-500',
    symptom: 'bg-yellow-500',
    diagnosis: 'bg-purple-500'
  };
  return colors[type] || 'bg-gray-500';
}

async function trackSymptom(symptomData) {
  const data = {
    symptom: symptomData.symptom,
    severity: symptomData.severity,
    date: new Date().toISOString(),
    notes: symptomData.notes
  };

  try {
    const response = await fetch("/api/patient/symptom-tracker", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error("Failed to track symptom");
    
    // After tracking, analyze trends
    await analyzeSymptomTrends();
  } catch (error) {
    console.error("Error tracking symptom:", error);
  }
}

async function analyzeSymptomTrends() {
  try {
    const response = await fetch("/api/patient/symptom-analysis", {
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
    });

    if (!response.ok) throw new Error("Failed to analyze symptoms");
    
    const analysis = await response.json();
    displaySymptomTrends(analysis);
  } catch (error) {
    console.error("Error analyzing symptoms:", error);
  }
}

async function setupMedicationReminders(medications) {
  if (!("Notification" in window)) {
    alert("This browser does not support notifications");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  medications.forEach(med => {
    const times = calculateMedicationTimes(med.frequency);
    times.forEach(time => {
      scheduleNotification(med.name, time);
    });
  });
}

function scheduleNotification(medicationName, time) {
  const now = new Date();
  const scheduledTime = new Date(time);
  
  const timeUntilNotification = scheduledTime - now;
  if (timeUntilNotification > 0) {
    setTimeout(() => {
      new Notification("Medication Reminder", {
        body: `Time to take your ${medicationName}`,
        icon: "/images/medicine-icon.png"
      });
    }, timeUntilNotification);
  }
}

class VirtualHealthAssistant {
  constructor() {
    this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    this.synthesis = window.speechSynthesis;
    this.setupVoiceRecognition();
  }

  setupVoiceRecognition() {
    this.recognition.continuous = false;
    this.recognition.lang = 'en-US';
    
    this.recognition.onresult = (event) => {
      const command = event.results[0][0].transcript.toLowerCase();
      this.processCommand(command);
    };
  }

  async processCommand(command) {
    if (command.includes('book appointment')) {
      this.speak('Opening appointment booking form');
      // Show appointment form
    } else if (command.includes('check prescriptions')) {
      this.speak('Fetching your prescriptions');
      await loadPrescriptions();
    }
  }

  speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    this.synthesis.speak(utterance);
  }

  startListening() {
    this.recognition.start();
  }
}

// Initialize virtual assistant
const virtualAssistant = new VirtualHealthAssistant();

async function setHealthGoal(goalData) {
  try {
    const response = await fetch("/api/patient/health-goals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
      body: JSON.stringify(goalData)
    });

    if (!response.ok) throw new Error("Failed to set health goal");
    await loadHealthGoals();
  } catch (error) {
    console.error("Error setting health goal:", error);
  }
}

async function updateGoalProgress(goalId, progress) {
  try {
    const response = await fetch(`/api/patient/health-goals/${goalId}/progress`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      },
      body: JSON.stringify({ progress })
    });

    if (!response.ok) throw new Error("Failed to update goal progress");
    await loadHealthGoals();
  } catch (error) {
    console.error("Error updating goal progress:", error);
  }
}
