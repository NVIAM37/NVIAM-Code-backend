import projectModel from '../models/project.model.js';
import mongoose from 'mongoose';

export const createProject = async ({
    name, userId
}) => {
    if (!name) {
        throw new Error('Name is required')
    }
    if (!userId) {
        throw new Error('UserId is required')
    }

    let project;
    try {
        project = await projectModel.create({
            name,
            users: [userId],
            fileTree: {},
            files: []
        });
    } catch (error) {
        if (error.code === 11000) {
            throw new Error('Project name already exists');
        }
        throw error;
    }

    return project;

}


export const getAllProjectByUserId = async ({ userId }) => {
    if (!userId) {
        throw new Error('UserId is required')
    }

    const allUserProjects = await projectModel.find({
        users: userId
    }).lean(); // Use lean for performance and consistency

    // Hydrate all projects
    allUserProjects.forEach(project => {
        if (project.files && project.files.length > 0) {
             const reconstructedTree = {};
             project.files.forEach(f => {
                 reconstructedTree[f.name] = { file: { contents: f.content } };
             });
             project.fileTree = reconstructedTree; 
        }
    });

    return allUserProjects;
}

export const addUsersToProject = async ({ projectId, users, userId }) => {

    if (!projectId) {
        throw new Error("projectId is required")
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId")
    }

    if (!users) {
        throw new Error("users are required")
    }

    if (!Array.isArray(users) || users.length === 0) {
        throw new Error("Invalid userId(s) in users array")
    }

    if (!userId) {
        throw new Error("userId is required")
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid userId")
    }


    const project = await projectModel.findOne({
        _id: projectId,
        users: userId
    })

    console.log(project)

    if (!project) {
        throw new Error("User not belong to this project")
    }

    const updatedProject = await projectModel.findOneAndUpdate({
        _id: projectId
    }, {
        $addToSet: {
            users: {
                $each: users
            }
        }
    }, {
        new: true
    })

    return updatedProject



}

export const getProjectById = async ({ projectId }) => {
    if (!projectId) {
        throw new Error("projectId is required")
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId")
    }

    const projectDoc = await projectModel.findOne({
        _id: projectId
    }).populate('users').lean();

    if (!projectDoc) return null;

    let project = projectDoc;

    // HYDRATION: Ensure `fileTree` is populated from `files` for consistency if files exist
    // This recovers data if fileTree (Object) lost keys due to dot notation issues
    if (project.files && project.files.length > 0) {
         const reconstructedTree = {};
         project.files.forEach(f => {
             reconstructedTree[f.name] = { file: { contents: f.content } };
         });
         
         // Always overwrite fileTree with the robust 'files' source of truth
         project.fileTree = reconstructedTree; 
    }

    return project;
}

export const updateFileTree = async ({ projectId, fileTree }) => {
    if (!projectId) {
        throw new Error("projectId is required")
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId")
    }

    if (!fileTree) {
        throw new Error("fileTree is required")
    }

    // Convert fileTree (Object) to files (Array) for robust storage
    const filesArray = Object.keys(fileTree).map(key => ({
        name: key,
        content: fileTree[key].file.contents
    }));

    // SANITIZATION: Remove keys with dots from validFileTree to prevent Mongo errors.
    // The robust 'files' array will hold these files.
    const validFileTree = {};
    Object.keys(fileTree).forEach(key => {
        if (!key.includes('.')) {
             validFileTree[key] = fileTree[key];
        } else {
            // For keys with dots (check.js), we rely solely on the files array
            // We can optionally replace dot with underscore if we want a placeholder?
            // No, getting from 'files' on load is cleaner.
        }
    });

    const projectDoc = await projectModel.findOneAndUpdate({
        _id: projectId
    }, {
        fileTree: validFileTree,
        files: filesArray
    }, {
        new: true
    })

    if (!projectDoc) throw new Error("Project not found");

    const project = projectDoc.toObject();

    // HYDRATION: Ensure response contains full file tree (including dot-files)
    if (project.files && project.files.length > 0) {
         const reconstructedTree = {};
         project.files.forEach(f => {
             reconstructedTree[f.name] = { file: { contents: f.content } };
         });
         project.fileTree = reconstructedTree; 
    }

    return project;
}

export const renameFile = async ({ projectId, oldName, newName }) => {
    if (!projectId) throw new Error("projectId is required");
    if (!oldName) throw new Error("oldName is required");
    if (!newName) throw new Error("newName is required");
    if (!mongoose.Types.ObjectId.isValid(projectId)) throw new Error("Invalid projectId");

    const project = await projectModel.findById(projectId);
    if (!project) throw new Error("Project not found");

    if (project.fileTree[newName]) {
        throw new Error("File with this name already exists");
    }

    if (!project.fileTree[oldName]) {
        throw new Error("File to rename not found");
    }

    const fileContent = project.fileTree[oldName];

    // Atomic update for both structures
    const updatedProject = await projectModel.findOneAndUpdate(
        { _id: projectId, "files.name": oldName },
        {
            $set: { 
                [`fileTree.${newName}`]: fileContent,
                "files.$.name": newName
            },
            $unset: { [`fileTree.${oldName}`]: "" }
        },
        { new: true }
    );

    return updatedProject;
}

export const deleteFile = async ({ projectId, fileName }) => {
    if (!projectId) throw new Error("projectId is required");
    if (!fileName) throw new Error("fileName is required");
    if (!mongoose.Types.ObjectId.isValid(projectId)) throw new Error("Invalid projectId");

    const project = await projectModel.findById(projectId);
    if (!project) throw new Error("Project not found");

    if (!project.fileTree[fileName]) {
        throw new Error("File not found");
    }

    const updatedProject = await projectModel.findOneAndUpdate(
        { _id: projectId },
        {
            $unset: { [`fileTree.${fileName}`]: "" },
            $pull: { files: { name: fileName } }
        },
        { new: true }
    );

    return updatedProject;

}

export const deleteProject = async ({ projectId, userId }) => {
    if (!projectId) throw new Error("projectId is required");
    if (!userId) throw new Error("userId is required");

    const project = await projectModel.findById(projectId);
    if (!project) throw new Error("Project not found");

    // Check if user is the owner (first user in array or strictly defined owner)
    // Assuming the first user is the creator/owner for now
    if (project.users[0].toString() !== userId.toString()) {
        throw new Error("Unauthorized: Only the project owner can delete this project");
    }

    await projectModel.findByIdAndDelete(projectId);
    return true;
}