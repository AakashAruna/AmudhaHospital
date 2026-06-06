const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');
const { SECRET_KEY, ALGORITHM } = require('../middleware/auth');

const ACCESS_TOKEN_EXPIRE_MINUTES = 480; // 8 hours

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ detail: 'Username and password are required' });
  }

  try {
    const user = await User.findOne({ where: { username } });
    if (!user || !bcrypt.compareSync(password, user.hashed_password)) {
      return res.status(401).json({ detail: 'Incorrect username or password' });
    }

    // Create token
    const tokenPayload = {
      sub: user.username,
      role: user.role
    };

    const accessToken = jwt.sign(tokenPayload, SECRET_KEY, {
      algorithm: ALGORITHM,
      expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m`
    });

    return res.json({
      access_token: accessToken,
      token_type: 'bearer',
      role: user.role,
      full_name: user.full_name
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ detail: 'Internal server error during login' });
  }
};

exports.getMe = async (req, res) => {
  // req.user is populated by authenticateToken middleware
  return res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    full_name: req.user.full_name
  });
};

exports.register = async (req, res) => {
  const { username, password, full_name, role, base_salary, daily_wage } = req.body;

  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ detail: 'All fields (username, password, full_name, role) are required' });
  }

  try {
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ detail: 'Username is already registered' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = await User.create({
      username,
      hashed_password: hashedPassword,
      role,
      full_name: full_name,
      base_salary: base_salary ? Number(base_salary) : 0.00,
      daily_wage: daily_wage ? Number(daily_wage) : 0.00
    });

    // Audit log
    await AuditLog.create({
      action_type: 'USER_REGISTER',
      description: `Registered user account: ${newUser.username} (Role: ${newUser.role}, Name: ${newUser.full_name})`,
      performed_by: 'system'
    });

    return res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      full_name: newUser.full_name,
      base_salary: newUser.base_salary,
      daily_wage: newUser.daily_wage
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ detail: 'Internal server error during registration' });
  }
};

exports.updateProfile = async (req, res) => {
  const { full_name, password } = req.body;
  const user = req.user;
  const updates = [];

  try {
    if (full_name) {
      user.full_name = full_name;
      updates.push('full name');
    }

    if (password) {
      user.hashed_password = bcrypt.hashSync(password, 10);
      updates.push('password');
    }

    if (updates.length > 0) {
      await user.save();

      // Audit log
      await AuditLog.create({
        action_type: 'USER_PROFILE_UPDATE',
        description: `Updated profile settings (${updates.join(', ')}) for user ${user.username}`,
        performed_by: user.username
      });
    }

    return res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name
    });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ detail: 'Internal server error during profile update' });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'role', 'full_name', 'base_salary', 'daily_wage'],
      order: [['full_name', 'ASC']]
    });
    return res.json(users);
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve user accounts' });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    // Prevent Admin from deleting themselves
    if (id === req.user.id) {
      return res.status(400).json({ detail: 'You cannot delete your own admin account.' });
    }

    const targetUser = await User.findByPk(id);
    if (!targetUser) {
      return res.status(404).json({ detail: 'User not found.' });
    }

    await targetUser.destroy();

    // Audit log
    await AuditLog.create({
      action_type: 'USER_DELETE',
      description: `Deleted staff user account: ${targetUser.username} (Role: ${targetUser.role}, Name: ${targetUser.full_name})`,
      performed_by: req.user.username
    });

    return res.json({ message: 'User account deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ detail: 'Failed to delete user account' });
  }
};

exports.updateBaseSalary = async (req, res) => {
  const { id } = req.params;
  const { base_salary } = req.body;

  if (base_salary === undefined || isNaN(Number(base_salary)) || Number(base_salary) < 0) {
    return res.status(400).json({ detail: 'Valid positive base salary is required.' });
  }

  try {
    const targetUser = await User.findByPk(id);
    if (!targetUser) {
      return res.status(404).json({ detail: 'User not found.' });
    }

    targetUser.base_salary = Number(base_salary);
    await targetUser.save();

    // Audit log
    await AuditLog.create({
      action_type: 'USER_SALARY_UPDATE',
      description: `Updated base salary for user ${targetUser.username} to ₹${Number(base_salary).toFixed(2)}`,
      performed_by: req.user.username
    });

    return res.json({
      id: targetUser.id,
      username: targetUser.username,
      role: targetUser.role,
      full_name: targetUser.full_name,
      base_salary: targetUser.base_salary,
      daily_wage: targetUser.daily_wage
    });
  } catch (err) {
    console.error('Update base salary error:', err);
    return res.status(500).json({ detail: 'Failed to update user base salary' });
  }
};
