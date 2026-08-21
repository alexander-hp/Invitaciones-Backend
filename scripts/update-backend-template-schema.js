const fs = require('fs');
const path = require('path');

const backendDir = path.resolve(__dirname, '../../Invitaciones-Backend');

// 1. Update src/routes/invitationRoutes.js
const routesPath = path.join(backendDir, 'src/routes/invitationRoutes.js');
let routesContent = fs.readFileSync(routesPath, 'utf8');

let routesModified = false;

// Add template: z.string().optional() inside invitationContentBody
if (!routesContent.includes('const invitationContentBody = z.object({\n  template: z.string().optional(),')) {
  routesContent = routesContent.replace(
    'const invitationContentBody = z.object({',
    'const invitationContentBody = z.object({\n  template: z.string().optional(),'
  );
  routesModified = true;
}

// Make template nullable in invitationCreateBody and invitationUpdateBody
if (routesContent.includes('template: z.string().min(12).optional()')) {
  routesContent = routesContent.replace(
    /template:\s*z\.string\(\)\.min\(12\)\.optional\(\)/g,
    'template: z.string().min(12).nullable().optional()'
  );
  routesModified = true;
}

if (routesModified) {
  fs.writeFileSync(routesPath, routesContent, 'utf8');
  console.log('src/routes/invitationRoutes.js updated successfully');
} else {
  console.log('src/routes/invitationRoutes.js already up to date');
}

// 2. Update src/models/Invitation.js
const modelPath = path.join(backendDir, 'src/models/Invitation.js');
let modelContent = fs.readFileSync(modelPath, 'utf8');

let modelModified = false;

if (!modelContent.includes('template: { type: String, trim: true },\n    headline: String,')) {
  modelContent = modelContent.replace(
    'content: {\n    headline: String,',
    'content: {\n    template: { type: String, trim: true },\n    headline: String,'
  );
  modelModified = true;
}

if (modelModified) {
  fs.writeFileSync(modelPath, modelContent, 'utf8');
  console.log('src/models/Invitation.js updated successfully');
} else {
  console.log('src/models/Invitation.js already up to date');
}

// 3. Update src/controllers/invitationController.js
const controllerPath = path.join(backendDir, 'src/controllers/invitationController.js');
let controllerContent = fs.readFileSync(controllerPath, 'utf8');

let controllerModified = false;

if (!controllerContent.includes("const mongoose = require('mongoose');")) {
  controllerContent = "const mongoose = require('mongoose');\n" + controllerContent;
  controllerModified = true;
}

if (controllerContent.includes('if (payload.template) {\n    const template = await Template.findById(payload.template).select(\'tier\');')) {
  controllerContent = controllerContent.replace(
    'if (payload.template) {\n    const template = await Template.findById(payload.template).select(\'tier\');',
    'if (payload.template && mongoose.Types.ObjectId.isValid(payload.template)) {\n    const template = await Template.findById(payload.template).select(\'tier\');'
  );
  controllerModified = true;
}

if (controllerModified) {
  fs.writeFileSync(controllerPath, controllerContent, 'utf8');
  console.log('src/controllers/invitationController.js updated successfully');
} else {
  console.log('src/controllers/invitationController.js already up to date');
}
