const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------- In-memory "database" ----------
let students = [
  { id: 1, name: "Asha Reddy", email: "asha@univ.edu", age: 20, course: "Computer Science", department: "Engineering" },
  { id: 2, name: "Ravi Kumar", email: "ravi@univ.edu", age: 21, course: "Electronics", department: "Engineering" },
];
let nextId = 3;

// ---------- Helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validates a student payload. When `partial` is true (PATCH), only supplied fields are checked.
function validate(body, partial = false) {
  const errors = [];
  const has = (f) => body[f] !== undefined;

  if (!partial || has("name")) {
    if (typeof body.name !== "string" || !body.name.trim()) errors.push("name is required and must be a non-empty string");
  }
  if (!partial || has("email")) {
    if (typeof body.email !== "string" || !EMAIL_RE.test(body.email)) errors.push("email is required and must be valid");
  }
  if (!partial || has("age")) {
    if (!Number.isInteger(body.age) || body.age < 16 || body.age > 100) errors.push("age is required and must be an integer between 16 and 100");
  }
  if (!partial || has("course")) {
    if (typeof body.course !== "string" || !body.course.trim()) errors.push("course is required and must be a non-empty string");
  }
  if (has("department") && typeof body.department !== "string") errors.push("department must be a string");

  return errors;
}

const emailTaken = (email, ignoreId = null) =>
  students.some((s) => s.email.toLowerCase() === email.toLowerCase() && s.id !== ignoreId);

const pick = (b) => ({
  name: b.name?.trim(),
  email: b.email?.trim().toLowerCase(),
  age: b.age,
  course: b.course?.trim(),
  department: b.department?.trim(),
});

// Resolves :id to a student or sends 400/404.
function findStudent(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ success: false, message: "id must be an integer" });
    return null;
  }
  const student = students.find((s) => s.id === id);
  if (!student) {
    res.status(404).json({ success: false, message: `Student with id ${id} not found` });
    return null;
  }
  return student;
}

// ---------- Routes ----------
app.get("/", (req, res) => res.json({ message: "Student Management API is running", endpoints: "/api/students" }));

// CREATE
app.post("/api/students", (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ success: false, errors });
  if (emailTaken(req.body.email)) return res.status(409).json({ success: false, message: "A student with this email already exists" });

  const student = { id: nextId++, ...pick(req.body) };
  students.push(student);
  res.status(201).json({ success: true, message: "Student created", data: student });
});

// READ ALL  (optional filters: ?course=...&search=...)
app.get("/api/students", (req, res) => {
  let result = students;
  const { course, search } = req.query;
  if (course) result = result.filter((s) => s.course.toLowerCase() === course.toLowerCase());
  if (search) result = result.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  res.json({ success: true, count: result.length, data: result });
});

// READ ONE
app.get("/api/students/:id", (req, res) => {
  const student = findStudent(req, res);
  if (student) res.json({ success: true, data: student });
});

// UPDATE (full replace)
app.put("/api/students/:id", (req, res) => {
  const student = findStudent(req, res);
  if (!student) return;

  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ success: false, errors });
  if (emailTaken(req.body.email, student.id)) return res.status(409).json({ success: false, message: "Email already used by another student" });

  Object.assign(student, pick(req.body));
  res.json({ success: true, message: "Student updated", data: student });
});

// UPDATE (partial)
app.patch("/api/students/:id", (req, res) => {
  const student = findStudent(req, res);
  if (!student) return;

  const errors = validate(req.body, true);
  if (errors.length) return res.status(400).json({ success: false, errors });
  if (req.body.email && emailTaken(req.body.email, student.id)) return res.status(409).json({ success: false, message: "Email already used by another student" });

  const changes = pick(req.body);
  Object.keys(changes).forEach((k) => changes[k] === undefined && delete changes[k]);
  Object.assign(student, changes);
  res.json({ success: true, message: "Student updated", data: student });
});

// DELETE
app.delete("/api/students/:id", (req, res) => {
  const student = findStudent(req, res);
  if (!student) return;
  students = students.filter((s) => s.id !== student.id);
  res.json({ success: true, message: "Student deleted", data: student });
});

// ---------- Error handling ----------
app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` }));

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ success: false, message: "Invalid JSON body" });
  console.error(err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;