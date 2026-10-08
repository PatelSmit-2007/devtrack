import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const body = req.body || {};
    const name = body.name;
    const description = body.description;

    if (typeof name !== 'string') {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    let trimmedDescription: string | undefined;

    if (description !== undefined) {
      if (typeof description !== 'string') {
        res.status(400).json({ error: 'Description must be a string' });
        return;
      }
      trimmedDescription = description.trim();
    }

    const project = await prisma.project.create({
      data: {
        name: trimmedName,
        description: trimmedDescription,
        ownerId: req.user,
      },
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const projects = await prisma.project.findMany({
      where: {
        ownerId: req.user,
      },
    });

    res.status(200).json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
