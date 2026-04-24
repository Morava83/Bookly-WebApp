// // Type 2: Group Meeting Scheduler

// // DOM container (IMPORTANT: must exist in HTML)
// const container = document.getElementById("scheduleContainer");

// // State
// let dates = [];
// let times = [];
// const votes = {}; // { "date_time": count }

// // Styling
// const style = document.createElement("style");
// style.textContent = `
//   #scheduleContainer table {
//     border-collapse: collapse;
//     font-family: Arial;
//     margin: 20px auto;
//     width: 90%;
//   }

//   #scheduleContainer td,
//   #scheduleContainer th {
//     border: 1px solid #ccc;
//     padding: 10px;
//     text-align: center;
//     cursor: pointer;
//     min-width: 80px;
//   }

//   #scheduleContainer th {
//     background: #f4f4f4;
//   }
// `;
// document.head.appendChild(style);

// // Build table
// function buildTable() {
//   if (!container) return;

//   let html = "<table><tr><th>Time</th>";

//   dates.forEach(date => {
//     html += `<th>${date}</th>`;
//   });

//   html += "</tr>";

//   times.forEach(time => {
//     html += `<tr><td>${time}</td>`;

//     dates.forEach(date => {
//       const key = `${date}_${time}`;
//       const count = votes[key] || 0;

//       html += `
//         <td data-key="${key}" style="background:${getColor(count)}">
//           ${count}
//         </td>`;
//     });

//     html += "</tr>";
//   });

//   html += "</table>";

//   container.innerHTML = html;
//   attachEvents();
// }


// // Heatmap color
// function getColor(count) {
//   const max = 10;
//   const intensity = Math.min(count / max, 1);

//   const r = 255;
//   const g = Math.floor(255 - intensity * 150);
//   const b = Math.floor(255 - intensity * 150);

//   return `rgb(${r}, ${g}, ${b})`;
// }

// // Click handling
// function attachEvents() {
//   document.querySelectorAll("#scheduleContainer td[data-key]").forEach(cell => {
//     cell.onclick = async () => {
//       const key = cell.dataset.key;
//       votes[key] = (votes[key] || 0) + 1;

//       const [date, time] = key.split("_");

//       await sendVote(date, time);

//       buildTable();
//     };
//   });
// }

// // Send vote to backend
// async function sendVote(date, time) {
//   try {
//     await fetch("/goup_meeting", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json"
//       },
//       body: JSON.stringify({ date, time })
//     });
//   } catch (err) {
//     console.error("Vote failed:", err);
//   }
// }

// // Load schedule from backend
// async function loadSchedule() {
//   try {
//     const res = await fetch("/goup_meeting", {
//       method: "GET"
//     });

//     const data = await res.json();

//     dates = data.dates || [];
//     times = data.times || [];

//     buildTable();
//   } catch (err) {
//     console.error("Failed to load schedule:", err);
//   }
// }

// // INIT
// loadSchedule();


//-------------------Dummy Table for demo1---------------
// Create basic styles dynamically
const style = document.createElement("style");
style.textContent = `
  table {
    border-collapse: collapse;
    font-family: Arial;
    margin: 20px;
  }
  td, th {
    border: 1px solid #ccc;
    padding: 10px;
    text-align: center;
    cursor: pointer;
    min-width: 80px;
  }
  th {
    background: #f4f4f4;
  }
`;
document.head.appendChild(style);

// Create table container
const table = document.createElement("table");
table.id = "scheduler";
document.body.appendChild(table);

// Data
const dates = ["2026-04-23", "2026-04-24", "2026-04-25"];
const times = ["09:00", "11:00", "13:00", "15:00"];
const votes = {}; // { "date_time": count }

// Build table
function buildTable() {
  let html = "<tr><th>Time</th>";

  dates.forEach(date => {
    html += `<th>${date}</th>`;
  });

  html += "</tr>";

  times.forEach(time => {
    html += `<tr><td>${time}</td>`;

    dates.forEach(date => {
      const key = `${date}_${time}`;
      const count = votes[key] || 0;

      html += `
        <td data-key="${key}" style="background:${getColor(count)}">
          ${count}
        </td>`;
    });

    html += "</tr>";
  });

  table.innerHTML = html;
  attachEvents();
}

// Color scaling (heatmap)
function getColor(count) {
  const max = 10;
  const intensity = Math.min(count / max, 1);

  const r = 255;
  const g = Math.floor(255 - intensity * 150);
  const b = Math.floor(255 - intensity * 150);

  return `rgb(${r}, ${g}, ${b})`;
}

// Click handling
function attachEvents() {
  document.querySelectorAll("td[data-key]").forEach(cell => {
    cell.onclick = () => {
      const key = cell.dataset.key;
      votes[key] = (votes[key] || 0) + 1;
      buildTable();
    };
  });
}

// Run immediately
buildTable();