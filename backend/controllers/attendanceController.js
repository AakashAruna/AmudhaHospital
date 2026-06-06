const { Op } = require('sequelize');
const { Attendance, User, AuditLog, Holiday } = require('../models');

exports.getAttendance = async (req, res) => {
  const { date, user_id, month, start_date, end_date } = req.query;
  const whereClause = {};
  const todayStr = new Date().toLocaleDateString('en-CA');

  try {
    if (req.user.role !== 'Admin') {
      // Non-admins can only see today's shift board, or their own historical records
      if (date === todayStr) {
        // Allowed to query all for today
      } else {
        // Must restrict historical logs to their own id
        whereClause.user_id = req.user.id;
      }

      if (user_id && user_id !== req.user.id && date !== todayStr) {
        return res.status(403).json({ detail: 'Access denied. You can only view your own attendance history.' });
      }
    } else {
      // Admins can filter by any user_id
      if (user_id) {
        whereClause.user_id = user_id;
      }
    }

    if (start_date && end_date) {
      whereClause.date = {
        [Op.between]: [start_date, end_date]
      };
    } else if (date) {
      whereClause.date = date;
    } else if (month) {
      // Month format: YYYY-MM
      whereClause.date = {
        [Op.iLike]: `${month}%`
      };
    }

    const records = await Attendance.findAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'role', 'full_name']
      }],
      order: [['date', 'DESC'], ['check_in', 'ASC']]
    });

    return res.json(records);
  } catch (err) {
    console.error('Get attendance error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve attendance logs' });
  }
};

exports.checkIn = async (req, res) => {
  const { status, notes } = req.body;
  const todayStr = new Date().toLocaleDateString('en-CA');

  try {
    const existing = await Attendance.findOne({
      where: { user_id: req.user.id, date: todayStr }
    });

    if (existing) {
      return res.status(400).json({ detail: 'You have already checked in today.' });
    }

    const record = await Attendance.create({
      user_id: req.user.id,
      date: todayStr,
      check_in: new Date(),
      status: status || 'Present',
      notes: notes || null
    });

    await AuditLog.create({
      action_type: 'ATTENDANCE_CHECKIN',
      description: `Staff check-in: ${req.user.full_name} (${req.user.role}) checked in as ${record.status}. Notes: ${record.notes || 'None'}`,
      performed_by: req.user.username
    });

    // Fetch record with user attributes to return
    const result = await Attendance.findByPk(record.id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'role', 'full_name']
      }]
    });

    return res.status(201).json(result);
  } catch (err) {
    console.error('Check in error:', err);
    return res.status(500).json({ detail: 'Failed to log check-in' });
  }
};

exports.checkOut = async (req, res) => {
  const todayStr = new Date().toLocaleDateString('en-CA');

  try {
    const record = await Attendance.findOne({
      where: { user_id: req.user.id, date: todayStr }
    });

    if (!record) {
      return res.status(400).json({ detail: 'No check-in record found for today.' });
    }

    if (record.check_out) {
      return res.status(400).json({ detail: 'You have already checked out today.' });
    }

    record.check_out = new Date();
    await record.save();

    await AuditLog.create({
      action_type: 'ATTENDANCE_CHECKOUT',
      description: `Staff check-out: ${req.user.full_name} (${req.user.role}) checked out.`,
      performed_by: req.user.username
    });

    const result = await Attendance.findByPk(record.id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'role', 'full_name']
      }]
    });

    return res.json(result);
  } catch (err) {
    console.error('Check out error:', err);
    return res.status(500).json({ detail: 'Failed to log check-out' });
  }
};

exports.logAttendance = async (req, res) => {
  const { user_id, date, status, check_in, check_out, notes } = req.body;

  if (!user_id || !date) {
    return res.status(400).json({ detail: 'Required fields missing: user_id, date' });
  }

  try {
    const [record, created] = await Attendance.findOrCreate({
      where: { user_id, date },
      defaults: {
        status: status || 'Present',
        notes: notes || null,
        check_in: check_in ? new Date(check_in) : null,
        check_out: check_out ? new Date(check_out) : null
      }
    });

    if (!created) {
      if (status) record.status = status;
      if (notes !== undefined) record.notes = notes;
      if (check_in !== undefined) record.check_in = check_in ? new Date(check_in) : null;
      if (check_out !== undefined) record.check_out = check_out ? new Date(check_out) : null;
      await record.save();
    }

    const targetUser = await User.findByPk(user_id);
    await AuditLog.create({
      action_type: 'ATTENDANCE_ADMIN_LOG',
      description: `Admin updated attendance for ${targetUser ? targetUser.full_name : user_id} on ${date}. Status: ${record.status}.`,
      performed_by: req.user.username
    });

    const result = await Attendance.findByPk(record.id, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'role', 'full_name']
      }]
    });

    return res.json(result);
  } catch (err) {
    console.error('Log/override attendance error:', err);
    return res.status(500).json({ detail: 'Failed to record administrative attendance entry' });
  }
};

exports.getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.findAll({ order: [['date', 'ASC']] });
    return res.json(holidays);
  } catch (err) {
    console.error('Get holidays error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve declared holidays' });
  }
};

exports.declareHoliday = async (req, res) => {
  const { date, description } = req.body;
  if (!date) return res.status(400).json({ detail: 'Date is required.' });

  try {
    const [holiday, created] = await Holiday.findOrCreate({
      where: { date },
      defaults: { description }
    });

    if (!created) {
      holiday.description = description;
      await holiday.save();
    }

    // Audit log
    await AuditLog.create({
      action_type: 'HOLIDAY_DECLARE',
      description: `Admin declared holiday on ${date}: ${description || 'No description'}`,
      performed_by: req.user.username
    });

    return res.json(holiday);
  } catch (err) {
    console.error('Declare holiday error:', err);
    return res.status(500).json({ detail: 'Failed to declare holiday' });
  }
};

exports.deleteHoliday = async (req, res) => {
  const { id } = req.params;
  try {
    const holiday = await Holiday.findByPk(id);
    if (!holiday) return res.status(404).json({ detail: 'Holiday not found' });

    await holiday.destroy();

    // Audit log
    await AuditLog.create({
      action_type: 'HOLIDAY_DELETE',
      description: `Admin deleted declared holiday on ${holiday.date}`,
      performed_by: req.user.username
    });

    return res.json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    console.error('Delete holiday error:', err);
    return res.status(500).json({ detail: 'Failed to delete holiday' });
  }
};
