import { Router } from 'express';
import { body } from 'express-validator';
import * as projectController from '../controllers/project.controller.js';
import * as authMiddleWare from '../middleware/auth.middleware.js';

const router = Router();


router.post('/create',
    authMiddleWare.authUser,
    body('name').isString().withMessage('Name is required'),
    projectController.createProject
)

router.post('/import',
    authMiddleWare.authUser,
    body('name').isString().withMessage('Name is required'),
    body('fileTree').isObject().withMessage('File Tree is required'),
    projectController.importProject
)

router.get('/all',
    authMiddleWare.authUser,
    projectController.getAllProject
)

router.put('/add-user',
    authMiddleWare.authUser,
    body('projectId').isString().withMessage('Project ID is required'),
    body('users').isArray({ min: 1 }).withMessage('Users must be an array of strings').bail()
        .custom((users) => users.every(user => typeof user === 'string')).withMessage('Each user must be a string'),
    projectController.addUserToProject
)

router.get('/get-project/:projectId',
    authMiddleWare.authUser,
    projectController.getProjectById
)

router.put('/update-file-tree/:projectId',
    authMiddleWare.authUser,
    body('fileTree').isObject().withMessage('File tree is required'),
    projectController.updateFileTree
)

// Removed extra parenthesis

router.put('/rename-file',
    authMiddleWare.authUser,
    body('projectId').isString().withMessage('Project ID is required'),
    body('oldName').isString().withMessage('Old name is required'),
    body('newName').isString().withMessage('New name is required'),
    projectController.renameFile
)

router.delete('/delete-file',
    authMiddleWare.authUser,
    body('projectId').isString().withMessage('Project ID is required'),
    body('fileName').isString().withMessage('File name is required'),
    projectController.deleteFile
)

router.post('/run',
    authMiddleWare.authUser,
    body('code').isObject().withMessage('Code object is required'),
    projectController.runProject
)


router.delete('/delete/:projectId',
    authMiddleWare.authUser,
    projectController.deleteProject
)

export default router;