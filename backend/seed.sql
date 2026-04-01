INSERT INTO users (id, name, email, phone, role) VALUES
('U001', 'Yohanes Sahrul', 'yohanessahrul92@gmail.com', '081703631403', 'admin'),
('U002', 'Budi Santoso', 'budi.a12@mail.com', '08123456789', 'warga'),
('U003', 'Sri Wulandari', 'sri.b03@mail.com', '081390008877', 'warga'),
('U004', 'Agus Pratama', 'agus.c21@mail.com', '081398887766', 'warga'),
('U005', 'Nadia Putri', 'nadia.a07@mail.com', '081222334455', 'warga'),
('U006', 'Sari Santoso', 'sari.a12@mail.com', '081277788899', 'warga'),
('U007', 'Finance Cluster', 'finance@smartperumahan.id', '081299900011', 'finance')
ON CONFLICT (id) DO NOTHING;

INSERT INTO houses (id, blok, nomor, residential_status, is_occupied) VALUES
('H001', 'A', '12', 'Owner', TRUE),
('H002', 'B', '03', 'Contract', TRUE),
('H003', 'C', '21', 'Owner', FALSE),
('H004', 'A', '07', 'Contract', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO house_users (house_id, user_email, user_order) VALUES
('H001', 'budi.a12@mail.com', 1),
('H001', 'sari.a12@mail.com', 2),
('H002', 'sri.b03@mail.com', 1),
('H003', 'agus.c21@mail.com', 1),
('H004', 'nadia.a07@mail.com', 1)
ON CONFLICT (house_id, user_email) DO NOTHING;

INSERT INTO bills (id, house_id, periode, amount, payment_method, status, status_date, paid_to_developer, date_paid_period_to_developer) VALUES
('BILL001', 'H001', 'Maret 2026', 'Rp150.000', 'Transfer Bank', 'Lunas', '2026-03-08T08:15:00+07:00', TRUE, '2026-03-28'),
('BILL002', 'H002', 'Maret 2026', 'Rp150.000', 'Transfer Bank', 'Belum Dibayar', '2026-03-01T09:00:00+07:00', FALSE, NULL),
('BILL003', 'H003', 'Maret 2026', 'Rp150.000', 'QRIS', 'Verifikasi', '2026-03-10T10:20:00+07:00', FALSE, NULL),
('BILL004', 'H004', 'Maret 2026', 'Rp150.000', 'Cash', 'Lunas', '2026-03-09T11:40:00+07:00', TRUE, '2026-03-29')
ON CONFLICT (id) DO NOTHING;

INSERT INTO transactions (id, bill_id, transaction_type, transaction_name, category, amount, date, payment_method, status, status_date) VALUES
('TRX001', 'BILL001', 'Pemasukan', 'Pembayaran IPL Warga', 'IPL Warga', 'Rp150.000', '2026-03-08T08:15:00+07:00', 'Transfer Bank', 'Lunas', '2026-03-08T08:15:00+07:00'),
('TRX002', 'BILL004', 'Pemasukan', 'Pembayaran IPL Warga', 'IPL Warga', 'Rp150.000', '2026-03-09T12:30:00+07:00', 'QRIS', 'Verifikasi', '2026-03-09T12:30:00+07:00'),
('TRX003', NULL, 'Pengeluaran', 'Transfer IPL ke Cluster', 'IPL Cluster', 'Rp500.000', '2026-03-10T14:45:00+07:00', 'Transfer Bank', 'Lunas', '2026-03-10T14:45:00+07:00')
ON CONFLICT (id) DO NOTHING;
