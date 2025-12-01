// /nix/store/cad18qxg9cgm7rcrgrjdxsp18s35lmk9-run-server

import express from 'express';
import multer from 'multer';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { exec } from 'child_process';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';

// import workflow_route from './workflow_router';
import workflow_route from './workflow_router.js'

import { scheduleCleanup } from './utils.js';

const app = express();
const port = 3000;

// Get the project's root directory
const projectRoot = process.cwd();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const generateSessionToken = () => {
  return crypto.randomBytes(6).toString('hex');
};

// ---------------------------------------------------------
// HELPER FUNCTION: Extract DB Tables
// ---------------------------------------------------------
function extractDBTables(sql) {
  // Normalize SQL
  const normalized = sql
    .replace(/\s+/g, " ") // collapse whitespace
    .replace(/--.*?(\r?\n|$)/g, " ") // remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, " "); // remove block comments

  const results = new Set();

  // Regex: looks for FROM or JOIN followed by schema.table pattern
  // We only capture full db.table references (alphanumeric, underscore allowed)
  const regex = /\b(?:FROM|JOIN)\s+([A-Z0-9_]+)\.([A-Z0-9_]+)/gi;

  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const fullName = `${match[1]}.${match[2]}`;
    results.add(fullName);
  }

  return Array.from(results);
}

// ---------------------------------------------------------
// HELPER FUNCTION: Clean SQL
// ---------------------------------------------------------

function cleanSQL(sqlContent) {
  let cleaned = sqlContent
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

  cleaned = cleaned.replace(
      /^\s*CREATE\s+OR\s+REPLACE\s+TABLE\s+\S+[\s\S]*?\bAS\b\s*/i,
      ''
  );

  cleaned = cleaned
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/;\s*$/, '');

  return cleaned;
}


// function cleanSQL(sqlContent) {
//     let cleaned = sqlContent
//         .replace(/--.*$/gm, '')
//         .replace(/\/\*[\s\S]*?\*\//g, '');

//     cleaned = cleaned.replace(/^\s*CREATE\s+OR\s+REPLACE\s+TABLE\s+\S+\s+AS\s*/is, '');

//     cleaned = cleaned
//         .replace(/\r?\n/g, ' ')
//         .replace(/\s+/g, ' ')
//         .trim();

//     cleaned = cleaned.replace(/;\s*$/, '');

//     return cleaned;
// }

// ---------------------------------------------------------
// SESSION & CLEANUP LOGIC
// ---------------------------------------------------------

// Schedule cleanup for a session
// export const scheduleCleanup = (token) => {
//   setTimeout(async () => {
//     const inputDir = path.join(projectRoot, 'input_files', token);
//     const outDir = path.join(projectRoot, 'out', token);
//     const paramDir = path.join(projectRoot, 'parameterize_tables', 'input_files', token);
//     const normalizeInputDir = path.join(projectRoot, 'normalize_sql', 'input_files', token);
//     const normalizeOutputDir = path.join(projectRoot, 'normalize_sql', 'cleaned_files', token);
//     const module2InputDir = path.join(projectRoot, 'module2_files', 'input_files', token);
//     const module2OutputDir = path.join(projectRoot, 'module2_files', 'output_files', token);
    
//     try {
//       await fs.rm(inputDir, { recursive: true, force: true });
//       await fs.rm(outDir, { recursive: true, force: true });
//       await fs.rm(paramDir, { recursive: true, force: true });
//       await fs.rm(normalizeInputDir, { recursive: true, force: true });
//       await fs.rm(normalizeOutputDir, { recursive: true, force: true });
//       await fs.rm(module2InputDir, { recursive: true, force: true });
//       await fs.rm(module2OutputDir, { recursive: true, force: true });
//       console.log(`Cleaned up files for session: ${token}`);
//     } catch (error) {
//       console.error(`Error cleaning up session ${token}:`, error);
//     }
//   }, 3 * 60 * 1000); // 3 minutes
// };


app.use((req, res, next) => {
  // Check if cookie already exists, if not create a new one
  let token = req.cookies.session_token;
  
  if (!token) {
    token = generateSessionToken();
    res.cookie('session_token', token, { 
      httpOnly: true,
      maxAge: 10 * 60 * 1000 // 10 minutes
    });
    console.log(`Created new session: ${token}`);
  } else {
    console.log(`Using existing session: ${token}`);
  }
  
  req.session_token = token;
  next();
});

// ---------------------------------------------------------
// MULTER CONFIGURATION
// ---------------------------------------------------------

// 1. Original Storage (Tab 1)
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const token = req.session_token;
    const dir = path.join(projectRoot, 'input_files', token);
    try {
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

// 2. New Storage (Tab 2) - parameterize_tables
const storageDbc = multer.diskStorage({
  destination: async (req, file, cb) => {
    const token = req.session_token;
    const dir = path.join(projectRoot, 'parameterize_tables', 'input_files', token);
    try {
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

// 3. New Storage (Tab 3) - normalize_sql
const storageNormalize = multer.diskStorage({
  destination: async (req, file, cb) => {
    const token = req.session_token;
    const dir = path.join(projectRoot, 'normalize_sql', 'input_files', token);
    try {
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });
const uploadDbc = multer({ storage: storageDbc });
const uploadNormalize = multer({ storage: storageNormalize });

// ---------------------------------------------------------
// ROUTES
// ---------------------------------------------------------

app.use('/workflow', workflow_route)


app.get('/home', (req, res) => {
  res.sendFile(path.join(projectRoot, './home.html'))
})

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>File Processor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f8f9fa;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      color: #333;
    }
    .container {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 40px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    h1 {
      color: #2c3e50;
      margin-bottom: 8px;
      font-size: 28px;
      font-weight: 600;
    }
    .session-info {
      color: #6c757d;
      font-size: 12px;
      margin-bottom: 20px;
      padding: 10px 12px;
      background: #f8f9fa;
      border-radius: 4px;
      border-left: 3px solid #dee2e6;
    }
    .session-token {
      font-family: 'Courier New', monospace;
      color: #495057;
      font-weight: 500;
    }

    /* --- UPDATED TABS CSS --- */
    .tabs-nav {
      display: flex;
      flex-wrap: wrap;          /* 🟢 New: Allows wrapping */
      margin-bottom: 30px;
      border-bottom: 1px solid #dee2e6;
      justify-content: space-between;
    }
    .tab-btn {
      padding: 10px 10px;       /* Reduced horizontal padding slightly */
      background: none;
      border: none;
      font-size: 14px;
      font-weight: 500;
      color: #6c757d;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
      white-space: nowrap;
      
      text-align: center;
      flex: 1 0 45%;           /* 🟢 New: Forces approx 50% width per button */
      margin-bottom: 4px;      /* 🟢 New: Adds small gap between rows */
    }
    /* ------------------------ */

    .tab-btn:hover { color: #2c3e50; }
    .tab-btn.active {
      color: #2c3e50;
      border-bottom: 2px solid #2c3e50;
    }
    .tab-content { display: none; }
    .tab-content.active {
      display: block;
      animation: fadeIn 0.3s ease;
    }
    .form-section { margin-bottom: 30px; }
    .form-title {
      font-size: 14px;
      color: #495057;
      margin-bottom: 12px;
      font-weight: 600;
    }
    .file-input-wrapper {
      position: relative;
      overflow: hidden;
      display: inline-block;
      width: 100%;
      margin-bottom: 12px;
    }
    .file-input-wrapper input[type=file] {
      position: absolute;
      left: -9999px;
    }
    .file-input-label {
      display: block;
      padding: 16px;
      background: #ffffff;
      border: 1px solid #ced4da;
      border-radius: 4px;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s ease;
      color: #495057;
      font-weight: 400;
      font-size: 14px;
    }
    .file-input-label:hover {
      background: #f8f9fa;
      border-color: #adb5bd;
    }
    .file-input-label.has-files {
      background: #f8f9fa;
      border-color: #6c757d;
    }
    .selected-files {
      margin-top: 8px;
      font-size: 13px;
      color: #6c757d;
      padding: 8px 12px;
      background: #f8f9fa;
      border-radius: 4px;
      line-height: 1.5;
    }
    button {
      width: 100%;
      padding: 12px 20px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #ffffff;
      color: #495057;
    }
    button:hover {
      background: #f8f9fa;
      border-color: #adb5bd;
    }
    button:active { background: #e9ecef; }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .upload-btn { margin-bottom: 8px; }
    .process-btn {
      background: #2c3e50;
      color: white;
      border-color: #2c3e50;
      margin-bottom: 8px;
    }
    .process-btn:hover {
      background: #34495e;
      border-color: #34495e;
    }
    .reverse-btn {
      background: #5a6c7d;
      color: white;
      border-color: #5a6c7d;
    }
    .extract-btn {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }
    .extract-btn:hover {
      background: #0069d9;
      border-color: #0062cc;
    }
    .normalize-btn {
      background: #28a745;
      color: white;
      border-color: #28a745;
    }
    .normalize-btn:hover {
      background: #218838;
      border-color: #1e7e34;
    }
    .divider {
      height: 1px;
      background: #e9ecef;
      margin: 30px 0;
    }
    .overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      z-index: 999;
    }
    .overlay.show {
      display: block;
      animation: fadeIn 0.2s ease;
    }
    .popup {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      text-align: center;
      min-width: 360px;
    }
    .popup.show {
      display: block;
      animation: popIn 0.2s ease;
    }
    .success-icon {
      width: 60px;
      height: 60px;
      background: #28a745;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 32px;
      color: white;
    }
    .popup h2 {
      color: #2c3e50;
      margin-bottom: 24px;
      font-size: 20px;
      font-weight: 600;
    }
    .progress-bar-container {
      width: 100%;
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 20px;
    }
    .progress-bar {
      height: 100%;
      background: #28a745;
      border-radius: 4px;
      transition: width 0.05s linear;
      width: 0%;
    }
    .button-description {
      font-size: 12px;
      color: #6c757d;
      margin-bottom: 8px;
      text-align: left;
    }
    #extractionResults {
      margin-top: 20px;
      padding: 15px;
      background: #2c3e50;
      color: #fff;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
      max-height: 200px;
      overflow-y: auto;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes popIn {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }
    .info-text {
      font-size: 12px;
      color: #6c757d;
      margin-top: 24px;
      text-align: center;
      padding-top: 16px;
      border-top: 1px solid #e9ecef;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>File Processor</h1>
    <div class="session-info">
      Session ID: <span class="session-token">${req.session_token}</span>
    </div>

    <div class="tabs-nav">
      <button class="tab-btn active" onclick="switchTab(1)">Change Parameterization Type</button>
      <button class="tab-btn" onclick="switchTab(2)">Parameterize DB & Tables</button>
      <button class="tab-btn" onclick="switchTab(3)">Normalize SQL</button>
      <button class="tab-btn" onclick="switchTab(4)">Format SQL</button>
    </div>

    <div id="tab1" class="tab-content active">
      <div class="form-section">
        <div class="form-title">Upload Files</div>
        <form id="uploadForm" enctype="multipart/form-data">
          <div class="file-input-wrapper">
            <input type="file" name="files" id="fileInput" multiple="multiple" />
            <label for="fileInput" class="file-input-label" id="fileLabel">
              Choose files to upload
            </label>
          </div>
          <div class="selected-files" id="selectedFiles" style="display: none;"></div>
          <button type="submit" class="upload-btn" id="uploadBtn">Upload Files</button>
        </form>
      </div>
      <div class="divider"></div>
      <div class="form-section">
        <div class="form-title">Process Files</div>
        <div class="button-description">Convert $variable → {variable}</div>
        <form action="/process" method="post">
          <input type="hidden" name="mode" value="forward" />
          <button type="submit" class="process-btn">Process Forward & Download</button>
        </form>
        <div class="button-description" style="margin-top: 16px;">Convert {variable} → $variable</div>
        <form action="/process" method="post">
          <input type="hidden" name="mode" value="reverse" />
          <button type="submit" class="reverse-btn">Process Reverse & Download</button>
        </form>
      </div>
    </div>

    <div id="tab2" class="tab-content">
      <div class="form-section">
        <div class="form-title">Upload SQL Files for DB Extraction</div>
        <form id="uploadFormDbc" enctype="multipart/form-data">
          <div class="file-input-wrapper">
            <input type="file" name="files" id="fileInputDbc" multiple="multiple" />
            <label for="fileInputDbc" class="file-input-label" id="fileLabelDbc">
              Choose SQL files
            </label>
          </div>
          <div class="selected-files" id="selectedFilesDbc" style="display: none;"></div>
          <button type="submit" class="upload-btn" id="uploadBtnDbc">Upload Files</button>
        </form>
      </div>
      <div class="divider"></div>
      <div class="form-section">
        <div class="form-title">Extract Information</div>
        <button type="button" class="extract-btn" id="extractBtn">Extract DB & Tables</button>
        <div id="extractionResults" style="display:none;"></div>
      </div>
    </div>

    <div id="tab3" class="tab-content">
      <div class="form-section">
        <div class="form-title">Upload SQL Files to Normalize</div>
        <form id="uploadFormNormalize" enctype="multipart/form-data">
          <div class="file-input-wrapper">
            <input type="file" name="files" id="fileInputNormalize" multiple="multiple" accept=".sql" />
            <label for="fileInputNormalize" class="file-input-label" id="fileLabelNormalize">
              Choose SQL files
            </label>
          </div>
          <div class="selected-files" id="selectedFilesNormalize" style="display: none;"></div>
          <button type="submit" class="upload-btn" id="uploadBtnNormalize">Upload Files</button>
        </form>
      </div>
      <div class="divider"></div>
      <div class="form-section">
        <div class="form-title">Normalize SQL Files</div>
        <div class="button-description">Remove comments, whitespace, and CREATE OR REPLACE statements</div>
        <form action="/normalize" method="post">
          <button type="submit" class="normalize-btn">Normalize & Download</button>
        </form>
      </div>
    </div>

    <div id="tab4" class="tab-content">
      <div class="form-section">
        <div class="form-title">Upload SQL Files to Format</div>
        <form id="uploadFormModule2" enctype="multipart/form-data">
          <div class="file-input-wrapper">
            <input type="file" name="files" id="fileInputModule2" multiple="multiple" accept=".json" />
            <label for="fileInputModule2" class="file-input-label" id="fileLabelModule2">
              Choose Json files
            </label>
          </div>
          <div class="selected-files" id="selectedFilesModule2" style="display: none;"></div>
          <button type="submit" class="upload-btn" id="uploadBtnModule2">Upload Files</button>
        </form>
      </div>
      <div class="divider"></div>
      <div class="form-section">
        <div class="form-title">Format SQL Files</div>
        <form action="/workflow/process_module2" method="post">
          <button type="submit" class="normalize-btn">Format & Download</button>
        </form>
      </div>
    </div>

    <div class="info-text">
      Note: Uploaded files are automatically deleted after 3 minutes
    </div>
  </div>

  <div class="overlay" id="overlay"></div>
  <div class="popup" id="popup">
    <div class="success-icon">✓</div>
    <h2>Files Uploaded Successfully</h2>
    <div class="progress-bar-container">
      <div class="progress-bar" id="progressBar"></div>
    </div>
  </div>

  <script>
    // --- TAB SWITCHING LOGIC ---
    function switchTab(tabIndex) {
      const tabs = document.querySelectorAll('.tab-content');
      const btns = document.querySelectorAll('.tab-btn');
      
      tabs.forEach(tab => tab.classList.remove('active'));
      btns.forEach(btn => btn.classList.remove('active'));
      
      document.getElementById('tab' + tabIndex).classList.add('active');
      btns[tabIndex - 1].classList.add('active');
    }

    // --- SHARED UPLOAD FUNCTION ---
    async function handleUpload(inputElement, btnElement, url, formId, labelElement, selectedElement) {
      const formData = new FormData();
      const files = inputElement.files;
      
      if (files.length === 0) {
        alert('Please select files to upload');
        return;
      }

      btnElement.disabled = true;
      const originalText = btnElement.textContent;
      btnElement.textContent = 'Uploading...';
      
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      
      try {
        const response = await fetch(url, { method: 'POST', body: formData });
        
        if (response.ok) {
          showSuccessPopup(formId, labelElement, selectedElement, btnElement, originalText);
        } else {
          alert('Upload failed. Please try again.');
          btnElement.disabled = false;
          btnElement.textContent = originalText;
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Upload failed. Please try again.');
        btnElement.disabled = false;
        btnElement.textContent = originalText;
      }
    }

    function showSuccessPopup(formId, labelElement, selectedElement, btnElement, originalText) {
      document.getElementById('overlay').classList.add('show');
      document.getElementById('popup').classList.add('show');
      
      const progressBar = document.getElementById('progressBar');
      let progress = 0;
      const duration = 1000;
      const interval = 20;
      const increment = (100 / duration) * interval;
      
      const progressInterval = setInterval(() => {
        progress += increment;
        progressBar.style.width = progress + '%';
        
        if (progress >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => {
            document.getElementById('overlay').classList.remove('show');
            document.getElementById('popup').classList.remove('show');
            progressBar.style.width = '0%';
            
            // Reset specific form
            document.getElementById(formId).reset();
            labelElement.classList.remove('has-files');
            
            if (formId === 'uploadFormDbc' || formId === 'uploadFormNormalize') {
              labelElement.textContent = 'Choose SQL files';
            } else if (formId === 'uploadFormModule2') {
              labelElement.textContent = 'Choose Json files';
            } else {
              labelElement.textContent = 'Choose files to upload';
            }
            
            selectedElement.style.display = 'none';
            selectedElement.textContent = '';
            btnElement.disabled = false;
            btnElement.textContent = originalText;
          }, 200);
        }
      }, interval);
    }

    // --- TAB 1 SETUP ---
    const fileInput = document.getElementById('fileInput');
    const fileLabel = document.getElementById('fileLabel');
    const selectedFiles = document.getElementById('selectedFiles');
    const uploadBtn = document.getElementById('uploadBtn');

    fileInput.addEventListener('change', (e) => updateFileLabel(e, fileLabel, selectedFiles, 'Choose files to upload'));
    document.getElementById('uploadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      handleUpload(fileInput, uploadBtn, '/upload', 'uploadForm', fileLabel, selectedFiles);
    });

    // --- TAB 2 SETUP ---
    const fileInputDbc = document.getElementById('fileInputDbc');
    const fileLabelDbc = document.getElementById('fileLabelDbc');
    const selectedFilesDbc = document.getElementById('selectedFilesDbc');
    const uploadBtnDbc = document.getElementById('uploadBtnDbc');
    const extractBtn = document.getElementById('extractBtn');
    const extractionResults = document.getElementById('extractionResults');

    fileInputDbc.addEventListener('change', (e) => updateFileLabel(e, fileLabelDbc, selectedFilesDbc, 'Choose SQL files'));
    document.getElementById('uploadFormDbc').addEventListener('submit', (e) => {
      e.preventDefault();
      handleUpload(fileInputDbc, uploadBtnDbc, '/upload_dbc', 'uploadFormDbc', fileLabelDbc, selectedFilesDbc);
    });
    
    extractBtn.addEventListener('click', async () => {
      extractBtn.disabled = true;
      extractBtn.textContent = 'Extracting...';
      extractionResults.style.display = 'none';
      try {
        const response = await fetch('/extract', { method: 'POST' });
        if(response.ok) {
          const data = await response.json();
          extractionResults.style.display = 'block';
          extractionResults.innerHTML = (data.tables && data.tables.length > 0) 
            ? '<strong>Found Tables:</strong><br>' + data.tables.join('<br>')
            : 'No tables found matching pattern (schema.table).';
        } else {
          alert('Extraction failed: ' + await response.text());
        }
      } catch(err) {
        console.error(err);
        alert('Error during extraction.');
      } finally {
        extractBtn.disabled = false;
        extractBtn.textContent = 'Extract DB & Tables';
      }
    });

    // --- TAB 3 SETUP ---
    const fileInputNormalize = document.getElementById('fileInputNormalize');
    const fileLabelNormalize = document.getElementById('fileLabelNormalize');
    const selectedFilesNormalize = document.getElementById('selectedFilesNormalize');
    const uploadBtnNormalize = document.getElementById('uploadBtnNormalize');

    fileInputNormalize.addEventListener('change', (e) => updateFileLabel(e, fileLabelNormalize, selectedFilesNormalize, 'Choose SQL files'));
    document.getElementById('uploadFormNormalize').addEventListener('submit', (e) => {
      e.preventDefault();
      handleUpload(fileInputNormalize, uploadBtnNormalize, '/upload_normalize', 'uploadFormNormalize', fileLabelNormalize, selectedFilesNormalize);
    });

    // --- TAB 4 SETUP ---
    const fileInputModule2 = document.getElementById('fileInputModule2');
    const fileLabelModule2 = document.getElementById('fileLabelModule2');
    const selectedFilesModule2 = document.getElementById('selectedFilesModule2');
    const uploadBtnModule2 = document.getElementById('uploadBtnModule2');

    fileInputModule2.addEventListener('change', (e) => updateFileLabel(e, fileLabelModule2, selectedFilesModule2, 'Choose Json files'));
    document.getElementById('uploadFormModule2').addEventListener('submit', (e) => {
      e.preventDefault();
      handleUpload(fileInputModule2, uploadBtnModule2, '/workflow/upload_module2', 'uploadFormModule2', fileLabelModule2, selectedFilesModule2);
    });

    // Helper for file inputs
    function updateFileLabel(e, label, display, defaultText) {
      const files = e.target.files;
      if (files.length > 0) {
        label.classList.add('has-files');
        label.textContent = files.length + ' file(s) selected';
        display.style.display = 'block';
        display.textContent = Array.from(files).map(f => f.name).join(', ');
      } else {
        label.classList.remove('has-files');
        label.textContent = defaultText;
        display.style.display = 'none';
        display.textContent = '';
      }
    }
  </script>
</body>
</html>
  `);
});

// ---------------------------------------------------------
// API HANDLERS
// ---------------------------------------------------------

// Original Upload Route
app.post('/upload', upload.array('files', 25), (req, res) => {
  scheduleCleanup(req.session_token);
  res.json({ success: true, message: 'Files uploaded successfully' });
});

// Upload Route for DB Extraction
app.post('/upload_dbc', uploadDbc.array('files', 25), (req, res) => {
  scheduleCleanup(req.session_token);
  res.json({ success: true, message: 'Files uploaded for DB extraction successfully' });
});

// Upload Route for Normalize SQL
app.post('/upload_normalize', uploadNormalize.array('files', 25), (req, res) => {
  scheduleCleanup(req.session_token);
  res.json({ success: true, message: 'Files uploaded for normalization successfully' });
});

// Extract Route
app.post('/extract', async (req, res) => {
  const token = req.session_token;
  const inputDir = path.join(projectRoot, 'parameterize_tables', 'input_files', token);
  
  try {
    try {
       await fs.access(inputDir);
    } catch {
       return res.status(404).send("No files found. Please upload SQL files first.");
    }
    
    const files = await fs.readdir(inputDir);
    if (files.length === 0) {
       return res.status(404).send("No files found to process.");
    }

    let allTables = new Set();

    for (const file of files) {
       const filePath = path.join(inputDir, file);
       const content = await fs.readFile(filePath, 'utf8');
       const tables = extractDBTables(content);
       tables.forEach(t => allTables.add(t));
    }

    res.json({ tables: Array.from(allTables).sort() });

  } catch (error) {
    console.error("Extraction error:", error);
    res.status(500).send("Error extracting tables");
  }
});

// Normalize SQL Route
app.post('/normalize', async (req, res) => {
  const token = req.session_token;
  const inputDir = path.join(projectRoot, 'normalize_sql', 'input_files', token);
  const outputDir = path.join(projectRoot, 'normalize_sql', 'cleaned_files', token);
  
  try {
    // Check if input directory exists
    try {
       await fs.access(inputDir);
    } catch {
       return res.status(404).send("No files found. Please upload SQL files first.");
    }
    
    const files = await fs.readdir(inputDir);
    const sqlFiles = files.filter(f => path.extname(f).toLowerCase() === '.sql');
    
    if (sqlFiles.length === 0) {
       return res.status(404).send("No SQL files found to process.");
    }

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Process each SQL file
    for (const file of sqlFiles) {
       const inputPath = path.join(inputDir, file);
       const outputPath = path.join(outputDir, file);
       
       const sqlContent = await fs.readFile(inputPath, 'utf8');
       const cleanedSQL = cleanSQL(sqlContent);
       
       await fs.writeFile(outputPath, cleanedSQL, 'utf8');
       console.log(`Normalized: ${file}`);
    }

    // Check if output directory has files
    const outputFiles = await fs.readdir(outputDir);
    if (outputFiles.length === 0) {
      return res.status(404).send("No processed files generated.");
    }

    // Stream the zip directly to the response
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.attachment(`normalized_sql_${token}.zip`);
    
    archive.on('error', (err) => {
        console.error('Archiving error:', err);
        res.status(500).send('Error creating zip file.');
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archive warning:', err);
      } else {
        throw err;
      }
    });

    archive.on('end', () => {
      console.log(`Archive streamed: ${archive.pointer()} total bytes`);
    });

    // Pipe directly to response
    archive.pipe(res);
    
    // Add all files from the output directory
    archive.directory(outputDir, false);
    
    archive.finalize();

  } catch (error) {
    console.error("Normalization error:", error);
    res.status(500).send("Error normalizing SQL files");
  }
});



app.post('/process', (req, res) => {
  const token = req.session_token;
  const mode = req.body.mode || 'forward';
  const inputDir = path.join(projectRoot, 'input_files', token);
  const outDir = path.join(projectRoot, 'out', token);
  const runScriptPath = path.join(projectRoot, 'run.js');

  exec(`node ${runScriptPath} ${token} ${mode}`, async (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).send(`Error processing files: ${stderr}`);
    }
    console.log(`stdout: ${stdout}`);
    if (stderr) console.error(`stderr: ${stderr}`);

    try {
        const outStats = await fs.stat(outDir);
        if (!outStats.isDirectory()) {
          return res.status(404).send("Output directory not found.");
        }
        
        const files = await fs.readdir(outDir, { recursive: true });
        console.log('Files in output directory:', files);
        
        if (files.length === 0) {
          return res.status(404).send("No processed files found. The output directory is empty.");
        }
    } catch (e) {
        console.error('Error accessing output directory:', e);
        return res.status(404).send("No processed files found to download. Make sure you have uploaded files first.");
    }

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.attachment(`processed_${mode}_${token}.zip`);
    
    archive.on('error', (err) => {
        console.error('Archiving error:', err);
        res.status(500).send('Error creating zip file.');
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archive warning:', err);
      } else {
        throw err;
      }
    });

    archive.on('end', () => {
      console.log(`Archive streamed: ${archive.pointer()} total bytes`);
    });

    archive.pipe(res);
    archive.directory(outDir, false);
    archive.finalize();
  });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});