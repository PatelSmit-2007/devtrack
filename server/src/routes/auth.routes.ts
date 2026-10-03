import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { isValidEmail } from '../utils/validation';
import { generateToken } from '../utils/jwt';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (!normalizedEmail || !normalizedName || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Email, password, and name are required',
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters',
      });
    }

    // Check if the email is already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Email is already registered',
      });
    }

    // Hash the password before storing it
    const passwordHash = await hashPassword(password);

    // Create the user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: normalizedName,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      user,
    });
  } catch (error) {
    console.error('Registration failed:', error);

    return res.status(500).json({
      error: 'Internal Server Error',
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
