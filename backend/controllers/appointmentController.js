const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Appointment, Patient, AuditLog } = require('../models');

exports.listAppointments = async (req, res) => {
  const { date_filter, q, doctor, status_filter } = req.query;
  const whereClause = {};

  if (q) {
    whereClause[Op.or] = [
      { patient_name: { [Op.iLike]: `%${q}%` } },
      { doctor_name: { [Op.iLike]: `%${q}%` } }
    ];
  }

  if (doctor) {
    whereClause.doctor_name = doctor;
  }

  if (status_filter) {
    whereClause.status = status_filter;
  }

  // Handle date filters
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (date_filter === 'today') {
    whereClause.appointment_date = todayStr;
  } else if (date_filter === 'upcoming') {
    whereClause.appointment_date = {
      [Op.gte]: todayStr
    };
  }

  try {
    const appointments = await Appointment.findAll({
      where: whereClause,
      order: [
        ['appointment_date', 'ASC'],
        ['queue_number', 'ASC']
      ]
    });
    return res.json(appointments);
  } catch (err) {
    console.error('List appointments error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve appointments' });
  }
};

exports.createAppointment = async (req, res) => {
  const {
    patient_name,
    patient_age,
    patient_gender,
    patient_contact,
    doctor_name,
    appointment_date,
    appointment_time,
    reason
  } = req.body;

  if (!patient_name || !patient_age || !patient_gender || !patient_contact || !doctor_name || !appointment_date || !appointment_time) {
    return res.status(400).json({ detail: 'Required fields missing' });
  }

  const transaction = await sequelize.transaction();

  try {
    // Check if patient already exists in patient registry
    const existingPatient = await Patient.findOne({
      where: {
        name: patient_name,
        contact: patient_contact
      },
      transaction
    });

    if (!existingPatient) {
      // Auto-create patient record
      const newPatient = await Patient.create({
        name: patient_name,
        age: patient_age,
        gender: patient_gender,
        contact: patient_contact,
        admission_status: 'Outpatient'
      }, { transaction });

      // Log patient creation
      await AuditLog.create({
        action_type: 'PATIENT_CREATE',
        description: `Auto-registered new patient ${newPatient.name} via appointment booking.`,
        performed_by: req.user.username
      }, { transaction });
    }

    const maxQueue = await Appointment.max('queue_number', {
      where: { doctor_name, appointment_date },
      transaction
    });
    const nextQueue = (maxQueue || 0) + 1;

    const appointment = await Appointment.create({
      patient_name,
      patient_age,
      patient_gender,
      patient_contact,
      doctor_name,
      appointment_date,
      appointment_time,
      queue_number: nextQueue,
      reason: reason || null,
      status: 'Scheduled',
      created_by: req.user.username
    }, { transaction });

    // Audit log
    await AuditLog.create({
      action_type: 'APPOINTMENT_CREATE',
      description: `Scheduled appointment (Token #${appointment.queue_number}) for patient ${appointment.patient_name} with ${appointment.doctor_name} on ${appointment.appointment_date} at ${appointment.appointment_time}.`,
      performed_by: req.user.username
    }, { transaction });

    await transaction.commit();
    return res.status(201).json(appointment);
  } catch (err) {
    await transaction.rollback();
    console.error('Create appointment error:', err);
    return res.status(500).json({ detail: 'Failed to create appointment' });
  }
};

exports.updateAppointment = async (req, res) => {
  const { appointment_id } = req.params;
  const updateData = req.body;

  const transaction = await sequelize.transaction();

  try {
    const appointment = await Appointment.findByPk(appointment_id, { transaction });
    if (!appointment) {
      await transaction.rollback();
      return res.status(404).json({ detail: 'Appointment not found' });
    }

    const overrides = [];
    for (const key of Object.keys(updateData)) {
      if (updateData[key] !== undefined && updateData[key] !== appointment[key]) {
        overrides.push(`${key}: ${appointment[key]} -> ${updateData[key]}`);
      }
    }

    let doctorChanged = updateData.doctor_name && updateData.doctor_name !== appointment.doctor_name;
    let dateChanged = updateData.appointment_date && updateData.appointment_date !== appointment.appointment_date;
    
    if (doctorChanged || dateChanged) {
      const newDoctor = updateData.doctor_name || appointment.doctor_name;
      const newDate = updateData.appointment_date || appointment.appointment_date;
      const maxQueue = await Appointment.max('queue_number', {
        where: { doctor_name: newDoctor, appointment_date: newDate },
        transaction
      });
      updateData.queue_number = (maxQueue || 0) + 1;
      overrides.push(`queue_number: ${appointment.queue_number} -> ${updateData.queue_number}`);
    }

    // Apply updates
    await appointment.update(updateData, { transaction });

    if (overrides.length > 0) {
      // Audit log
      await AuditLog.create({
        action_type: 'APPOINTMENT_UPDATE',
        description: `Updated appointment for ${appointment.patient_name}: ${overrides.join(', ')}`,
        performed_by: req.user.username
      }, { transaction });
    }

    await transaction.commit();
    return res.json(appointment);
  } catch (err) {
    await transaction.rollback();
    console.error('Update appointment error:', err);
    return res.status(500).json({ detail: 'Failed to update appointment' });
  }
};

exports.deleteAppointment = async (req, res) => {
  const { appointment_id } = req.params;

  const transaction = await sequelize.transaction();

  try {
    const appointment = await Appointment.findByPk(appointment_id, { transaction });
    if (!appointment) {
      await transaction.rollback();
      return res.status(404).json({ detail: 'Appointment not found' });
    }

    // Audit log
    await AuditLog.create({
      action_type: 'APPOINTMENT_DELETE',
      description: `Deleted appointment record for ${appointment.patient_name} with ${appointment.doctor_name} scheduled for ${appointment.appointment_date}.`,
      performed_by: req.user.username
    }, { transaction });

    await appointment.destroy({ transaction });

    await transaction.commit();
    return res.status(204).end();
  } catch (err) {
    await transaction.rollback();
    console.error('Delete appointment error:', err);
    return res.status(500).json({ detail: 'Failed to delete appointment' });
  }
};

exports.getNextQueueNumber = async (req, res) => {
  const { doctor_name, appointment_date } = req.query;
  if (!doctor_name || !appointment_date) {
    return res.status(400).json({ detail: 'doctor_name and appointment_date are required' });
  }
  try {
    const maxQueue = await Appointment.max('queue_number', {
      where: { doctor_name, appointment_date }
    });
    return res.json({ next_queue: (maxQueue || 0) + 1 });
  } catch (err) {
    console.error('Get next queue number error:', err);
    return res.status(500).json({ detail: 'Failed to calculate next queue number' });
  }
};
