from flask import Flask
from flask_sock import Sock
import json
import requests
import logging
from io import BytesIO

# 로깅 설정
logging.basicConfig(
    level=logging.DEBUG,
    encoding='UTF-8',
    format='%(asctime)s - %(levelname)s - %(message)s',
    filename='test.log',
    filemode='a',
    force=True
)
logger = logging.getLogger(__name__)
logger.debug("logger is online")

app = Flask(__name__)
sock = Sock(app)

@app.before_request
def setup_context():
    with app.app_context():
        logger.info('App context initialized')

# OpenAI API 요청을 처리하는 함수
def generate_audio(api_key, gpt_response):
    url = "https://api.openai.com/v1/audio/speech"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "tts-1",
        "input": f"{gpt_response}",
        "voice": "nova",
        "response_format": "wav"
    }
    try:
        logger.debug(f"헤더 전송됨 header: {headers} payload: {payload}")
        response = requests.post(url, headers=headers, json=payload, stream=True)
        if response.status_code == 200:
            audio_data = BytesIO()
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    audio_data.write(chunk)
            audio_data.seek(0)
            return audio_data
        else:
            logger.error(f"Open AI 에러: {response.status_code}, {response.text}")
            return None
    except requests.RequestException as e:
        logger.error(f"Error API 요청: {e}")
        return None

@sock.route('/ws')
def websocket(ws):
    logger.debug("Websocket 연결 성공")
    try:
        while True:
            data = ws.receive()
            if data:
                parsed_data = json.loads(data)
                api_key = parsed_data.get('apiKey', None)
                gpt_response = parsed_data.get('gptResponse', None)

                if gpt_response:
                    logger.info(f"GPT response: {gpt_response}")
                    audio_data = generate_audio(api_key, gpt_response)

                    if audio_data and audio_data.getbuffer().nbytes > 0:
                        logger.info(f"Audio data size: {audio_data.getbuffer().nbytes} bytes")
                        ws.send(audio_data.getvalue()) # 오디오 결과 바이너리 버퍼(풀 파일)로 전달
                        logger.info("Audio file sent successfully.")
                    else:
                        logger.error("Audio data is empty or invalid.")
                        ws.send(json.dumps({"status": "error", "message": "audio data empty"}))
                else:
                    logger.warning("No GPT Response provided, ignoring message.")
                    ws.send(json.dumps({"status": "error", "message": "No GPT Response provided"}))
    except Exception as e:
        error_message = {"status": "error", "message": f"{type(e).__name__} - {str(e)}"}
        logger.error(json.dumps(error_message))
        ws.send(json.dumps(error_message))
    finally:
        logger.debug("WebSocket connection closed.")

if __name__ == '__main__':
    logger.debug("flask server start!")
    app.run(host='0.0.0.0', port=5500, debug=True, threaded=True)
