const video = document.getElementById("camera");
const result = document.getElementById("result");

const MODEL_URL =
"https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

let students = [];
let marked = {};
let cameraStream = null;
let recognitionRunning = false;
let absentTimer = null;

// ==========================================
// START CAMERA
// ==========================================

async function startCamera() {

try {

    result.textContent = "Loading AI...";

    // Reset attendance
    students = [];
    marked = {};

    // Stop old camera if exists
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }

    // Load AI models
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);

    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);


    // Load student faces
    result.textContent = "Loading student faces...";

    await loadStudents();


    if (students.length === 0) {

        throw new Error(
            "No student faces were loaded."
        );

    }


    // Open laptop camera
    cameraStream =
        await navigator.mediaDevices.getUserMedia({

            video: true,
            audio: false

        });


    video.srcObject = cameraStream;

    video.style.display = "block";


    result.textContent =
        "Camera ready - Looking for students...";


    video.onloadedmetadata = () => {

        video.play();

        recognitionRunning = true;

        recognizeFace();

        startAbsentTimer();

    };


} catch (error) {

    console.error(error);

    result.textContent =
        "Error: " + error.message;

}


}

// ==========================================
// STOP CAMERA
// ==========================================

function stopCamera() {

recognitionRunning = false;


if (cameraStream) {

    cameraStream
        .getTracks()
        .forEach(track => track.stop());

    cameraStream = null;

}


if (absentTimer) {

    clearInterval(absentTimer);

    absentTimer = null;

}


video.srcObject = null;

video.style.display = "none";


result.textContent =
    "Camera is off";


}

// ==========================================
// LOAD STUDENT FACES
// ==========================================

async function loadStudents() {

const names = [
    "Messi",
    "Gavi",
    "Pedri"
];


for (const name of names) {

    try {

        result.textContent =
            "Loading " + name + "...";


        const image =
            await faceapi.fetchImage(
                `students/${name.toLowerCase()}.jpg`
            );


        const detection =
            await faceapi
                .detectSingleFace(
                    image,
                    new faceapi.TinyFaceDetectorOptions()
                )
                .withFaceLandmarks()
                .withFaceDescriptor();


        if (detection) {

            students.push(

                new faceapi.LabeledFaceDescriptors(
                    name,
                    [detection.descriptor]
                )

            );


            console.log(
                `${name} loaded successfully`
            );


        } else {

            console.warn(
                `No face found in ${name}.jpg`
            );

        }


    } catch (error) {

        console.error(
            `Error loading ${name}:`,
            error
        );

    }

}


}

// ==========================================
// FACE RECOGNITION
// ==========================================

async function recognizeFace() {

if (!recognitionRunning) {
    return;
}


try {

    const detection =
        await faceapi
            .detectSingleFace(
                video,
                new faceapi.TinyFaceDetectorOptions()
            )
            .withFaceLandmarks()
            .withFaceDescriptor();


    if (detection && students.length > 0) {

        const matcher =
            new faceapi.FaceMatcher(
                students,
                0.6
            );


        const match =
            matcher.findBestMatch(
                detection.descriptor
            );


        if (match.label !== "unknown") {

            // Face detected
            result.textContent =
                match.label + " is detected";


            // Register attendance
            markAttendance(
                match.label
            );


        } else {

            result.textContent =
                "Unknown person";

        }

    }


} catch (error) {

    console.error(
        "Recognition error:",
        error
    );

}


setTimeout(
    recognizeFace,
    500
);


}

// ==========================================
// GET TIME FROM USER INPUT
// ==========================================

function getTimeFromInput(inputId) {

const input =
    document.getElementById(inputId);


if (!input) {
    return null;
}


const value =
    input.value;


if (!value) {
    return null;
}


const parts =
    value.split(":");


const hours =
    Number(parts[0]);


const minutes =
    Number(parts[1]);


if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
) {

    return null;

}


const time =
    new Date();


time.setHours(
    hours,
    minutes,
    0,
    0
);


return time;


}

// ==========================================
// FORMAT TIME
// ==========================================

function formatTime(date) {

return date.toLocaleTimeString(
    [],
    {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    }
);


}

// ==========================================
// MARK ATTENDANCE
// ==========================================

function markAttendance(name) {

// Student already processed
if (marked[name]) {
    return;
}


const now =
    new Date();


// ALL TIMES COME FROM INPUTS
const classStart =
    getTimeFromInput(
        "classStartTime"
    );


const lateTime =
    getTimeFromInput(
        "lateTime"
    );


const absentTime =
    getTimeFromInput(
        "absentTime"
    );


// Check settings
if (
    !classStart ||
    !lateTime ||
    !absentTime
) {

    result.textContent =
        "Please enter all attendance times first.";

    return;

}


// ======================================
// BEFORE CLASS
// ======================================

if (now < classStart) {

    result.textContent =
        `${name} is detected - Class has not started yet`;

    return;

}


// ======================================
// AFTER ABSENT TIME
// ======================================

if (now >= absentTime) {

    result.textContent =
        `${name} is detected, but attendance is already closed.`;

    return;

}


// ======================================
// FIND STUDENT ROW
// ======================================

const row =
    document.getElementById(
        "student-" + name
    );


if (!row) {

    console.error(
        "Student row not found:",
        name
    );

    return;

}


const arrival =
    row.querySelector(
        ".arrival"
    );


const status =
    row.querySelector(
        ".status"
    );


// ======================================
// SAVE ARRIVAL TIME
// ======================================

arrival.textContent =
    formatTime(now);


// ======================================
// PRESENT
// ======================================

if (now < lateTime) {

    status.textContent =
        "Present";


    status.className =
        "status present";


    result.textContent =
        `${name} is Present - Arrival: ${formatTime(now)}`;


    marked[name] = true;


    sendAttendanceNotification(
        name,
        "Present",
        now
    );


    return;

}


// ======================================
// LATE
// ======================================

if (now >= lateTime && now < absentTime) {

    status.textContent =
        "Late";


    status.className =
        "status late";


    result.textContent =
        `${name} is Late - Arrival: ${formatTime(now)}`;


    marked[name] = true;


    sendAttendanceNotification(
        name,
        "Late",
        now
    );


    return;

}


}

// ==========================================
// ABSENT CHECK
// ==========================================

function startAbsentTimer() {

// Remove old timer
if (absentTimer) {

    clearInterval(absentTimer);

}


absentTimer =
    setInterval(
        checkAbsentStudents,
        1000
    );


}

// ==========================================
// CHECK ABSENT STUDENTS
// ==========================================

function checkAbsentStudents() {

if (!recognitionRunning) {
    return;
}


const absentTime =
    getTimeFromInput(
        "absentTime"
    );


if (!absentTime) {
    return;
}


const now =
    new Date();


// Not time for absent yet
if (now < absentTime) {
    return;
}


// Attendance period finished
markAbsentStudents();


clearInterval(absentTimer);

absentTimer = null;


}

// ==========================================
// MARK ABSENT STUDENTS
// ==========================================

function markAbsentStudents() {

const names = [
    "Messi",
    "Gavi",
    "Pedri"
];


names.forEach(name => {

    // Student already attended
    if (marked[name]) {
        return;
    }


    const row =
        document.getElementById(
            "student-" + name
        );


    if (!row) {
        return;
    }


    const arrival =
        row.querySelector(
            ".arrival"
        );


    const status =
        row.querySelector(
            ".status"
        );


    // No arrival
    arrival.textContent =
        "-";


    // Absent
    status.textContent =
        "Absent";


    status.className =
        "status absent";


    // Prevent duplicate processing
    marked[name] = true;


    console.log(
        `${name} is Absent`
    );


    sendAttendanceNotification(
        name,
        "Absent",
        null
    );

});


result.textContent =
    "Attendance is now closed.";


}

// ==========================================
// NOTIFICATION
// ==========================================

function sendAttendanceNotification(
studentName,
status,
arrivalTime
) {

const classTimeElement =
    document.getElementById(
        "classStartTime"
    );


const classTime =
    classTimeElement
        ? classTimeElement.value
        : "-";


const notification = {

    student: studentName,

    status: status,

    arrival: arrivalTime
        ? formatTime(arrivalTime)
        : null,

    classTime: classTime,

    dateTime:
        new Date().toLocaleString()

};


let notifications =
    JSON.parse(
        localStorage.getItem(
            "parentNotifications"
        ) || "[]"
    );


notifications.push(
    notification
);


localStorage.setItem(
    "parentNotifications",
    JSON.stringify(
        notifications
    )
);


console.log(
    "PARENT NOTIFICATION:",
    notification
);


}
