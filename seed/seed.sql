INSERT INTO doctors (name, specialization) VALUES ('Dr. Priya Natarajan','Cardiology');
INSERT INTO doctors (name, specialization) VALUES ('Dr. Rajesh Kumar','Oncology');

INSERT INTO resources (type, name, total_count, available_count) VALUES
('room','OT-1',1,1),
('room','Consult-1',1,1),
('equipment','ECG-1',1,1),
('equipment','Ultrasound-1',1,1),
('staff','Nurse-A',2,2);

INSERT INTO slots (doctor_id, start_time, end_time, capacity, available_seats)
VALUES
(1, now() + interval '1 hour', now() + interval '1 hour 15 minutes', 1, 1),
(1, now() + interval '2 hours', now() + interval '2 hours 15 minutes', 1, 1),
(2, now() + interval '3 hours', now() + interval '3 hours 15 minutes', 2, 2);

-- attach resources to slots
INSERT INTO slot_resources (slot_id, resource_id, required_count) VALUES
(1, 2, 1), -- Consult-1 for slot 1
(1, 3, 1), -- ECG-1
(1, 5, 1), -- Nurse-A (need one)
(3, 1, 1), -- OT-1 for slot 3 (surgery)
(3, 4, 1), -- Ultrasound-1
(3, 5, 2); -- two nurses for slot 3
