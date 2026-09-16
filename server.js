/* ==========================================================================
   Greasy Dental Care - Online Express Backend Server (server.js - PostgreSQL)
   ========================================================================== */

   const express = require('express');
   const { Pool } = require('pg');
   const cors = require('cors');
   require('dotenv').config();
   
   const app = express();
   const PORT = process.env.PORT || 3000;
   
   // Middleware
   app.use(cors());
   app.use(express.json());
   
   // PostgreSQL Connection Pool using DATABASE_URL from your .env file
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
   });
   
   // Test Database Connection on Startup
   pool.connect((err, client, release) => {
     if (err) {
       console.error('Error connecting to online database:', err.stack);
     } else {
       console.log('Successfully connected to online PostgreSQL/Supabase database!');
       release();
     }
   });
   
   // API Endpoint: Patient Registration & Appointment Booking
   app.post('/api/appointments', async (req, res) => {
     const { fullName, email, phone, dob, dentistId, appointmentDate, appointmentTime, notes } = req.body;
   
     try {
       // 1. Check if patient already exists
       let patientRes = await pool.query('SELECT patient_id FROM patients WHERE email = $1', [email]);
       let patientId;
   
       if (patientRes.rows.length === 0) {
         // Create new patient record
         const newPatient = await pool.query(
           'INSERT INTO patients (full_name, email, phone, date_of_birth) VALUES ($1, $2, $3, $4) RETURNING patient_id',
           [fullName, email, phone, dob]
         );
         patientId = newPatient.rows[0].patient_id;
       } else {
         patientId = patientRes.rows[0].patient_id;
       }
   
       // 2. Create the appointment record
       const newAppointment = await pool.query(
         `INSERT INTO appointments (patient_id, dentist_id, appointment_date, appointment_time, service_type, status, notes) 
          VALUES ($1, $2, $3, $4, $5, 'future', $6) RETURNING appointment_id`,
         [patientId, dentistId || 1, appointmentDate, appointmentTime, 'General Consultation', notes]
       );
   
       res.status(201).json({ success: true, appointmentId: newAppointment.rows[0].appointment_id });
     } catch (error) {
       console.error('Database Error:', error);
       res.status(500).json({ error: 'Failed to record appointment booking.' });
     }
   });
   
   // API Endpoint: Staff Portal Reporting Engine
   app.get('/api/reports', async (req, res) => {
     const { search, status } = req.query;
   
     try {
       let query = `
         SELECT 
           a.appointment_id AS id,
           p.full_name AS patient,
           p.phone AS phone,
           d.full_name AS dentist,
           a.service_type AS service,
           TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS date,
           a.appointment_time AS time,
           a.status AS status
         FROM appointments a
         JOIN patients p ON a.patient_id = p.patient_id
         JOIN dentists d ON a.dentist_id = d.dentist_id
         WHERE 1=1
       `;
   
       const queryParams = [];
   
       if (status && status !== 'all') {
         queryParams.push(status);
         query += ` AND a.status = $${queryParams.length}`;
       }
   
       if (search) {
         queryParams.push(`%${search}%`);
         query += ` AND (LOWER(p.full_name) LIKE LOWER($${queryParams.length}) OR LOWER(a.service_type) LIKE LOWER($${queryParams.length}))`;
       }
   
       query += ` ORDER BY a.appointment_date DESC`;
   
       const result = await pool.query(query, queryParams);
       res.json(result.rows);
     } catch (error) {
       console.error('Report Error:', error);
       res.status(500).json({ error: 'Failed to retrieve reports.' });
     }
   });
   
   app.listen(PORT, () => {
     console.log(`Greasy Dental Care online server running on port ${PORT}`);
   });
   