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
    
    // Chat elements
    const chatIcon = document.getElementById('chat-icon');
    const chatBox = document.getElementById('chat-box');
    const closeChat = document.getElementById('close-chat');
    const chatMessageInput = document.getElementById('chat-message');
    const sendChatBtn = document.getElementById('send-chat');
    const chatHistory = document.getElementById('chat-history');
    const notificationBadge = document.getElementById('notification-badge');
    
    // Store the session ID when you receive it from the /analyze endpoint
    let currentSessionId = null;
    
    // Force chatbox to be hidden on load
    if (chatBox) {
        // Use CSS class instead of hidden attribute for better compatibility
        chatBox.classList.add('hidden');
    }
    if (notificationBadge) {
        notificationBadge.classList.add('hidden');
    }
    
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
        if (!file.type.match('image.*')) {
            alert('Please select an image file');
            return;
        }
        
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
        
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        
        previewContainer.hidden = true;
        loadingElement.hidden = false;
        resultsSection.hidden = true;
        
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
                
                // Show notification on chat icon
                if (notificationBadge) {
                    notificationBadge.classList.remove('hidden');
                }
                
                // Clear any existing messages
                if (chatHistory) {
                    chatHistory.innerHTML = '';
                    
                    // Add welcome message
                    const welcomeMessage = document.createElement('div');
                    welcomeMessage.classList.add('chat-message', 'ai-message');
                    welcomeMessage.innerText = "Analysis complete! I can help answer questions about the medical image. What would you like to know?";
                    chatHistory.appendChild(welcomeMessage);
                    
                    // Ensure scroll to bottom
                    setTimeout(() => {
                        chatHistory.scrollTop = chatHistory.scrollHeight;
                    }, 100);
                }
                
                // Add New Scan button to results section
                addNewScanButton();
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
    
    function displayResults(data) {
        console.log("API Response:", data); // Debugging
    
        // Store the session ID for chat functionality
        currentSessionId = data.session_id;
        console.log("Session ID stored:", currentSessionId);
    
        // Check if the required properties exist before using them
        const geminiText = data.gemini_analysis ? data.gemini_analysis : "No Gemini analysis available.";
        const llamaText = data.llama_analysis ? data.llama_analysis : "No Llama analysis available.";
        const finalText = data.final_analysis ? data.final_analysis : "No final analysis available.";
    
        console.log("Gemini Analysis:", geminiText);
        console.log("Llama Analysis:", llamaText);
        console.log("Final Analysis:", finalText);
    
        // Use marked.parse only if the content is not undefined or null
        geminiContent.innerHTML = marked.parse(geminiText);
        llamaContent.innerHTML = marked.parse(llamaText);
        finalContent.innerHTML = marked.parse(finalText);
    
        document.querySelectorAll('pre code').forEach(block => hljs.highlightBlock(block));
    }
    
    // Add New Scan button function
    function addNewScanButton() {
        // Remove existing button if it exists
        if (document.getElementById('new-scan-btn')) {
            document.getElementById('new-scan-btn').remove();
        }
        
        // Create button element
        const newScanBtn = document.createElement('button');
        newScanBtn.id = 'new-scan-btn';
        newScanBtn.className = 'btn primary';
        newScanBtn.innerHTML = '<i class="fas fa-plus"></i> New Scan';
        
        // Add click event to reset UI
        newScanBtn.addEventListener('click', () => {
            resetUI();
        });
        
        // Add button to the top of results section
        resultsSection.insertBefore(newScanBtn, resultsSection.firstChild);
    }
    
    // Tab Switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
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
        loadingElement.hidden = true;
        
        // Reset chat history
        if (chatHistory) {
            chatHistory.innerHTML = '';
        }
        
        // Reset session ID
        currentSessionId = null;
        
        // Hide chat notification and chat box
        if (notificationBadge) {
            notificationBadge.classList.add('hidden');
        }
        if (chatBox) {
            chatBox.classList.add('hidden');
        }
        
        // Remove the New Scan button if it exists
        if (document.getElementById('new-scan-btn')) {
            document.getElementById('new-scan-btn').remove();
        }
    }
    
    // Chat icon toggle - use class instead of hidden attribute
    if (chatIcon) {
        chatIcon.addEventListener('click', () => {
            // Toggle the 'hidden' class instead of the hidden attribute
            chatBox.classList.toggle('hidden');
            
            // Hide notification when chat is opened
            if (!chatBox.classList.contains('hidden')) {
                if (notificationBadge) {
                    notificationBadge.classList.add('hidden');
                }
                
                // Focus on input when chat is opened
                if (chatMessageInput) {
                    chatMessageInput.focus();
                }
                
                // Make sure chat is scrolled to bottom when opened
                if (chatHistory) {
                    setTimeout(() => {
                        chatHistory.scrollTop = chatHistory.scrollHeight;
                    }, 100);
                }
            }
        });
    }
    
    // Close chat button
    if (closeChat) {
        closeChat.addEventListener('click', () => {
            if (chatBox) {
                chatBox.classList.add('hidden');
            }
        });
    }
    
    // Chat functionality
    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', () => {
            sendChatMessage();
        });
    }
    
    // Also handle Enter key press in the chat input
    if (chatMessageInput) {
        chatMessageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendChatMessage();
                e.preventDefault();
            }
        });
    }
    
    function sendChatMessage() {
        if (!chatMessageInput || !chatHistory) return;
        
        const message = chatMessageInput.value.trim();
        if (message === '') return;
        
        // Check if session ID is available
        if (!currentSessionId) {
            const errorDiv = document.createElement('div');
            errorDiv.classList.add('chat-message', 'error-message');
            errorDiv.innerText = "Error: No active session. Please analyze an image first.";
            chatHistory.appendChild(errorDiv);
            
            // Force scroll after adding message
            setTimeout(() => {
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }, 100);
            
            return;
        }
        
        const userMessageDiv = document.createElement('div');
        userMessageDiv.classList.add('chat-message', 'user-message');
        userMessageDiv.innerText = message;
        chatHistory.appendChild(userMessageDiv);
        chatMessageInput.value = '';
        
        // Add a loading message
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('chat-message', 'ai-message', 'loading-message');
        loadingDiv.innerText = "Thinking...";
        chatHistory.appendChild(loadingDiv);
        
        // Force scroll after adding messages
        setTimeout(() => {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }, 100);
        
        fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: message,
                session_id: currentSessionId 
            })
        })
        .then(response => response.json())
        .then(data => {
            // Remove the loading message
            if (loadingDiv.parentNode === chatHistory) {
                chatHistory.removeChild(loadingDiv);
            }
            
            const aiMessageDiv = document.createElement('div');
            aiMessageDiv.classList.add('chat-message', 'ai-message');
            
            if (data.success) {
                aiMessageDiv.innerText = data.response;
            } else {
                aiMessageDiv.classList.add('error-message');
                aiMessageDiv.innerText = "Error: " + (data.error || "Unknown error occurred");
            }
            
            chatHistory.appendChild(aiMessageDiv);
            
            // Force scroll after adding response with delay to ensure rendering
            setTimeout(() => {
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }, 100);
        })
        .catch(error => {
            // Remove the loading message
            if (loadingDiv.parentNode === chatHistory) {
                chatHistory.removeChild(loadingDiv);
            }
            
            console.error('Error:', error);
            const errorDiv = document.createElement('div');
            errorDiv.classList.add('chat-message', 'error-message');
            errorDiv.innerText = "Error: " + error.message;
            chatHistory.appendChild(errorDiv);
            
            // Force scroll after adding error
            setTimeout(() => {
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }, 100);
        });
    }
});