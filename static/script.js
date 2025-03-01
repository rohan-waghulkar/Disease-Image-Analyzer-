// script.js
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    const imagePreview = document.getElementById('image-preview');
    const changeImageBtn = document.getElementById('change-image');
    const analyzeBtn = document.getElementById('analyze-btn');
    const loadingElement = document.getElementById('loading');
    const resultsSection = document.getElementById('results-section');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // Gemini and Llama content elements
    const geminiContent = document.getElementById('gemini-content');
    const llamaContent = document.getElementById('llama-content');
    const finalContent = document.getElementById('final-content');
    
    // File Upload Handlers
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('active');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('active');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('active');
        
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFile(fileInput.files[0]);
        }
    });
    
    changeImageBtn.addEventListener('click', () => {
        resetUI();
    });
    
    // Handle selected file
    function handleFile(file) {
        // Check if file is an image
        if (!file.type.match('image.*')) {
            alert('Please select an image file');
            return;
        }
        
        // Display preview
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            uploadArea.hidden = true;
            previewContainer.hidden = false;
        };
        reader.readAsDataURL(file);
    }
    
    // Analyze Image
    analyzeBtn.addEventListener('click', () => {
        if (!imagePreview.src) {
            alert('Please select an image first');
            return;
        }
        
        // Prepare form data
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        
        // Show loading spinner
        previewContainer.hidden = true;
        loadingElement.hidden = false;
        resultsSection.hidden = true;
        
        // Send request to server
        fetch('/analyze', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            loadingElement.hidden = true;
            if (data.success) {
                displayResults(data);
                resultsSection.hidden = false;
            } else {
                alert('Error: ' + data.error);
                previewContainer.hidden = false;
            }
        })
        .catch(error => {
            loadingElement.hidden = true;
            previewContainer.hidden = false;
            alert('Error: ' + error.message);
        });
    });
    
    // Display Analysis Results
    function displayResults(data) {
        // Convert markdown to HTML and render analysis content
        geminiContent.innerHTML = marked.parse(data.gemini_analysis);
        llamaContent.innerHTML = marked.parse(data.llama_analysis);
        finalContent.innerHTML = marked.parse(data.final_analysis);
        
        // Initialize syntax highlighting for code blocks
        document.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightBlock(block);
        });
    }
    
    // Tab Switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked button and corresponding pane
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Reset UI
    function resetUI() {
        fileInput.value = '';
        imagePreview.src = '';
        uploadArea.hidden = false;
        previewContainer.hidden = true;
        resultsSection.hidden = true;
    }
});
