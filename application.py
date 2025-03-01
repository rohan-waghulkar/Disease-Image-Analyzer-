import os
import base64
import requests
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
import google.generativeai as genai
from PIL import Image

# Initialize Flask application
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Configure API keys
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "your-google-api-key")
genai.configure(api_key=GOOGLE_API_KEY)

# Configure Ollama endpoint
OLLAMA_API_ENDPOINT = "https://lamprey-useful-slug.ngrok-free.app/api/generate"

# Set up Gemini model
gemini_model = genai.GenerativeModel('gemini-1.5-pro')

def analyze_image_with_gemini(image_path):
    """
    Analyze image using Google's Gemini 1.5 Pro model
    """
    try:
        img = Image.open(image_path)
        
        # Prepare prompt for image analysis
        prompt = """
        Perform a detailed medical analysis of this image. Please include:
        
        1. Primary medical findings or abnormalities visible
        2. Any visible symptoms, lesions, or pathological indicators
        3. Anatomical structures affected or involved
        4. Visual characteristics (color, shape, distribution, size) of any concerning features
        5. Potential differential diagnoses based solely on visual assessment
        6. Additional diagnostic tests that might be relevant
        
        Note: If the image appears to be a medical scan (X-ray, CT, MRI, ultrasound), describe the visible structures and any apparent abnormalities.
        
        Provide a thorough analysis while remaining clinically focused. Remember to include appropriate medical disclaimers regarding the limitations of image-based diagnosis.
        """
        
        # Generate content with the image
        response = gemini_model.generate_content([prompt, img])
        
        return {
            "success": True,
            "analysis": response.text
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def analyze_image_with_llama(image_path):
    """
    Analyze image using Llama 3.2 vision model through Ollama
    """
    try:
        # Convert image to base64 - fixed encoding method
        with open(image_path, "rb") as img_file:
            img_data = base64.b64encode(img_file.read()).decode('utf-8')
        
        prompt = """
        Perform a detailed medical analysis of this image. Please include:
        
        1. Primary medical findings or abnormalities visible
        2. Any visible symptoms, lesions, or pathological indicators
        3. Anatomical structures affected or involved
        4. Visual characteristics (color, shape, distribution, size) of any concerning features
        5. Potential differential diagnoses based solely on visual assessment
        6. Additional diagnostic tests that might be relevant
        
        Note: If the image appears to be a medical scan (X-ray, CT, MRI, ultrasound), describe the visible structures and any apparent abnormalities.
        
        Provide a thorough analysis while remaining clinically focused.
        """
        
        # Create payload for Ollama API with image - format as expected by Ollama
        payload = {
            "model": "llama3.2-vision:11b",
            "prompt": prompt,
            "stream": False,
            "images": [img_data],  # Removed the data:image/jpeg;base64, prefix
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
                "analysis": result["response"]
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
            "error": f"Error analyzing with Llama: {str(e)}\n{traceback.format_exc()}"
        }

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
    
    if file:
        # Save the uploaded file
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        try:
            # Step 1: Analyze with Gemini
            gemini_result = analyze_image_with_gemini(file_path)
            
            if not gemini_result["success"]:
                return jsonify({
                    "success": False,
                    "error": f"Gemini analysis failed: {gemini_result['error']}"
                })
            
            # Step 2: Analyze with Llama
            llama_result = analyze_image_with_llama(file_path)
            
            if not llama_result["success"]:
                return jsonify({
                    "success": False,
                    "error": f"Llama analysis failed: {llama_result['error']}"
                })
            
            # Step 3: Combine analyses with Llama
            final_result = combine_analyses(gemini_result["analysis"], llama_result["analysis"])
            
            if not final_result["success"]:
                return jsonify({
                    "success": False,
                    "error": f"Final analysis generation failed: {final_result['error']}"
                })
            
            # Return all analyses and the file path
            return jsonify({
                "success": True,
                "image_path": f"/static/uploads/{filename}",
                "gemini_analysis": gemini_result["analysis"],
                "llama_analysis": llama_result["analysis"],
                "final_analysis": final_result["final_analysis"]
            })
        except Exception as e:
            import traceback
            return jsonify({
                "success": False,
                "error": f"Error during analysis process: {str(e)}\n{traceback.format_exc()}"
            })
    
    return jsonify({"success": False, "error": "Unknown error occurred"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
