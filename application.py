import os
import base64
import requests
from flask import Flask, render_template, request, jsonify, session
from werkzeug.utils import secure_filename
import google.generativeai as genai
from PIL import Image
import uuid

# Initialize Flask application
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload
app.secret_key = os.environ.get("SECRET_KEY", os.urandom(24).hex())  # For session management

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Configure API keys
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "your-google-api-key")
genai.configure(api_key=GOOGLE_API_KEY)

# Configure Ollama endpoint
OLLAMA_API_ENDPOINT = "https://lamprey-useful-slug.ngrok-free.app/api/generate"

# Set up Gemini model
gemini_model = genai.GenerativeModel('gemini-1.5-pro')

# Session storage for analysis results
session_data = {}

def analyze_image_with_gemini(image_path):
    try:
        img = Image.open(image_path)
        prompt = "Perform a detailed medical analysis of this image. Include key findings, abnormalities, and potential diagnoses."
        response = gemini_model.generate_content([prompt, img])
        return {"success": True, "analysis": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}

def analyze_image_with_llama(image_path):
    try:
        with open(image_path, "rb") as img_file:
            img_data = base64.b64encode(img_file.read()).decode('utf-8')
        
        prompt = "Perform a detailed medical analysis of this image. Include key findings, abnormalities, and potential diagnoses."
        
        payload = {
            "model": "llama3.2-vision:11b",
            "prompt": prompt,
            "stream": False,
            "images": [img_data],
            "options": {"temperature": 0.1, "top_p": 0.9, "top_k": 40}
        }
        
        response = requests.post(OLLAMA_API_ENDPOINT, json=payload)
        
        if response.status_code == 200:
            return {"success": True, "analysis": response.json()["response"]}
        else:
            return {"success": False, "error": f"Ollama API error: {response.status_code} - {response.text}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
def combine_analyses(gemini_analysis, llama_analysis):
    """
    Send both analyses to Llama 3.2 to produce a final conclusion
    """
    try:
        prompt = f"""
        I have two medical image analyses from different AI models. Please:
        1. Compare and contrast the findings from both analyses
        2. Identify points of agreement and disagreement
        3. Determine which observations are most likely accurate
        4. Synthesize a comprehensive final analysis
        5. Provide the final analysis in markdown format with appropriate headings
        
        Analysis from Gemini 1.5 Pro:
        {gemini_analysis}
        
        Analysis from Llama 3.2:
        {llama_analysis}
        """
        
        # Create payload for Ollama API - using text-only model
        payload = {
            "model": "llama3.2-vision:11b",  # Changed to standard model without vision capabilities
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "top_p": 0.9,
                "top_k": 40
            }
        }
        
        # Make request to Ollama
        response = requests.post(OLLAMA_API_ENDPOINT, json=payload)
        
        if response.status_code == 200:
            result = response.json()
            return {
                "success": True,
                "final_analysis": result["response"]
            }
        else:
            return {
                "success": False,
                "error": f"Ollama API error: {response.status_code} - {response.text}"
            }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": f"Error combining analyses: {str(e)}\n{traceback.format_exc()}"
        }
def chat_with_analysis(session_id, user_message):
    try:
        if session_id not in session_data:
            return {"success": False, "error": "No analysis data found for this session", "response": None}
        
        analysis_data = session_data[session_id]
        
        # Add some additional error checking
        gemini_analysis = analysis_data.get('gemini_analysis', 'No Gemini analysis available.')
        llama_analysis = analysis_data.get('llama_analysis', 'No Llama analysis available.')
        
        context = f"GEMINI ANALYSIS:\n{gemini_analysis}\n\nLLAMA ANALYSIS:\n{llama_analysis}"
        prompt = f"{context}\n\nUser Query: {user_message}\nProvide an informative response based on the above analysis."
        
        payload = {
            "model": "llama3.2-vision:11b",
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "top_p": 0.9, "top_k": 40}
        }
        
        response = requests.post(OLLAMA_API_ENDPOINT, json=payload)
        
        if response.status_code == 200:
            response_data = response.json()
            return {"success": True, "response": response_data.get("response", "No response content")}
        else:
            error_msg = f"Chat API error: {response.status_code} - {response.text}"
            return {"success": False, "error": error_msg, "response": None}
    except Exception as e:
        return {"success": False, "error": str(e), "response": None}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    if 'image' not in request.files:
        return jsonify({"success": False, "error": "No image uploaded"})

    file = request.files['image']
    if file.filename == '':
        return jsonify({"success": False, "error": "No image selected"})

    session_id = str(uuid.uuid4())
    session['session_id'] = session_id
    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)

    gemini_result = analyze_image_with_gemini(file_path)
    llama_result = analyze_image_with_llama(file_path)

    # Ensure the analysis text is valid before saving
    gemini_analysis = gemini_result.get("analysis", "No Gemini analysis available.")
    llama_analysis = llama_result.get("analysis", "No Llama analysis available.")

    session_data[session_id] = {
        "image_path": f"/static/uploads/{filename}",
        "gemini_analysis": gemini_analysis,
        "llama_analysis": llama_analysis,
        "chat_history": []
    }
    final_result = combine_analyses(gemini_result["analysis"], llama_result["analysis"])

    # Debugging: Print session data
    print(f"Session Data ({session_id}):", session_data[session_id])

    return jsonify({
        "success": True,
        "session_id": session_id,
        "image_path": f"/static/uploads/{filename}",
        "gemini_analysis": gemini_analysis,
        "llama_analysis": llama_analysis,
        "final_analysis": final_result["final_analysis"]
    })


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    session_id = data.get('session_id')
    message = data.get('message')
    
    if not session_id or not message:
        return jsonify({"success": False, "error": "Missing session_id or message"})
    
    chat_result = chat_with_analysis(session_id, message)
    
    if session_id in session_data and chat_result.get("success"):
        session_data[session_id]["chat_history"].append({
            "user": message,
            "assistant": chat_result.get("response", "No response available")
        })
    
    return jsonify(chat_result)
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
