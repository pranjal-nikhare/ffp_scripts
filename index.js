import express from 'express';
import multer from 'multer';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { exec } from 'child_process';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';

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

// Schedule cleanup for a session
const scheduleCleanup = (token) => {
  setTimeout(async () => {
    const inputDir = path.join(projectRoot, 'input_files', token);
    const outDir = path.join(projectRoot, 'out', token);
    
    try {
      await fs.rm(inputDir, { recursive: true, force: true });
      await fs.rm(outDir, { recursive: true, force: true });
      console.log(`Cleaned up files for session: ${token}`);
    } catch (error) {
      console.error(`Error cleaning up session ${token}:`, error);
    }
  }, 3 * 60 * 1000); // 3 minutes
};

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

const upload = multer({ storage: storage });

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>File Processor</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

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
          margin-bottom: 30px;
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

        .form-section {
          margin-bottom: 30px;
        }

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

        button:active {
          background: #e9ecef;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .upload-btn {
          margin-bottom: 8px;
        }

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

        .process-btn:active {
          background: #1a252f;
        }

        .reverse-btn {
          background: #5a6c7d;
          color: white;
          border-color: #5a6c7d;
        }

        .reverse-btn:hover {
          background: #6c7f91;
          border-color: #6c7f91;
        }

        .reverse-btn:active {
          background: #4a5a6a;
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
        const fileInput = document.getElementById('fileInput');
        const fileLabel = document.getElementById('fileLabel');
        const selectedFiles = document.getElementById('selectedFiles');
        const uploadBtn = document.getElementById('uploadBtn');

        fileInput.addEventListener('change', (e) => {
          const files = e.target.files;
          if (files.length > 0) {
            fileLabel.classList.add('has-files');
            fileLabel.textContent = files.length + ' file(s) selected';
            selectedFiles.style.display = 'block';
            selectedFiles.textContent = Array.from(files).map(f => f.name).join(', ');
          } else {
            fileLabel.classList.remove('has-files');
            fileLabel.textContent = 'Choose files to upload';
            selectedFiles.style.display = 'none';
            selectedFiles.textContent = '';
          }
        });

        document.getElementById('uploadForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = new FormData();
          const files = fileInput.files;
          
          if (files.length === 0) {
            alert('Please select files to upload');
            return;
          }

          uploadBtn.disabled = true;
          uploadBtn.textContent = 'Uploading...';
          
          for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
          }
          
          try {
            const response = await fetch('/upload', {
              method: 'POST',
              body: formData
            });
            
            if (response.ok) {
              // Show popup
              document.getElementById('overlay').classList.add('show');
              document.getElementById('popup').classList.add('show');
              
              // Animate progress bar (1 second)
              const progressBar = document.getElementById('progressBar');
              let progress = 0;
              const duration = 1000; // 1 second
              const interval = 20; // Update every 20ms
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
                    
                    // Reset form and labels
                    document.getElementById('uploadForm').reset();
                    fileLabel.classList.remove('has-files');
                    fileLabel.textContent = 'Choose files to upload';
                    selectedFiles.style.display = 'none';
                    selectedFiles.textContent = '';
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = 'Upload Files';
                  }, 200);
                }
              }, interval);
            } else {
              alert('Upload failed. Please try again.');
              uploadBtn.disabled = false;
              uploadBtn.textContent = 'Upload Files';
            }
          } catch (error) {
            console.error('Error:', error);
            alert('Upload failed. Please try again.');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Files';
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.post('/upload', upload.array('files', 25), (req, res) => {
  // Schedule cleanup for this session
  scheduleCleanup(req.session_token);
  res.json({ success: true, message: 'Files uploaded successfully' });
});

app.post('/process', (req, res) => {
  const token = req.session_token;
  const mode = req.body.mode || 'forward'; // 'forward' or 'reverse'
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
        
        // Check if directory has files
        const files = await fs.readdir(outDir, { recursive: true });
        console.log('Files in output directory:', files);
        
        if (files.length === 0) {
          return res.status(404).send("No processed files found. The output directory is empty.");
        }
    } catch (e) {
        console.error('Error accessing output directory:', e);
        return res.status(404).send("No processed files found to download. Make sure you have uploaded files first.");
    }

    // Stream the zip directly to the response without saving to disk
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

    // Pipe directly to response
    archive.pipe(res);
    
    // Add all files from the output directory
    archive.directory(outDir, false);
    
    archive.finalize();
  });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});