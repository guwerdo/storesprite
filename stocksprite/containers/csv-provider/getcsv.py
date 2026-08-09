import paramiko
import requests
import pandas
import os
import logging
import subprocess
from datetime import datetime

# --- Configuration ---
LOCAL_DIR = "/csv-provider-data"
LOG_FILE = os.path.join(LOCAL_DIR, "log.log")
DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1466871573913800969/4ZQPBLI5xzZkvTRc1ZGCe_pltn1oBfxfARGQL1Q5gzryrjHmuv5HCKNAzr7yFKzpCXIq"

# Cromwell
CROMWELL_SFTP_HOST = "sftp.cromwell.co.uk"
CROMWELL_SFTP_USER = "agrogarden"
CROMWELL_SFTP_KEY = "/secrets/cromwell-sftp-private-id_rsa"
CROMWELL_SFTP_REMOTE_DIR = "/"
CROMWELL_FILE_RAW = os.path.join(LOCAL_DIR, "cromwell-raw.csv")
CROMWELL_FILE_FINAL = os.path.join(LOCAL_DIR, "cromwell.csv")

# Magictools
MAGICTOOLS_URL = "https://media.magictools.hu/shared/products.csv"
MAGICTOOLS_FILE_RAW = os.path.join(LOCAL_DIR, "magictools-raw.csv")
MAGICTOOLS_FILE_FINAL = os.path.join(LOCAL_DIR, "magictools.csv")

# Madalbal
MADALBAL_URL = "https://xml.madalbal.hu/partnerwebxml/xml?id=xEhQKOrrIe"
MADALBAL_FILE_RAW = os.path.join(LOCAL_DIR, "madalbal-raw.xml")
MADALBAL_FILE_FINAL = os.path.join(LOCAL_DIR, "madalbal.csv")

# Depiend
DEPIEND_URL = "https://www.depiend.hu/egyediarjegyzek/nyilvanos/be1f34de72726a8aa516e6cde3290e404c303ddcc59529f1fbeb2f58ee03ad68318"
DEPIEND_FILE_RAW = os.path.join(LOCAL_DIR, "depiend-raw.csv")
DEPIEND_FILE_FINAL = os.path.join(LOCAL_DIR, "depiend.csv")

# Stanley
STANLEY_URL = "https://stanleyszekrenybolt.hu/stanleytoloajto.xml"
STANLEY_FILE_RAW = os.path.join(LOCAL_DIR, "stanley-raw.xml")
STANLEY_FILE_FINAL = os.path.join(LOCAL_DIR, "stanley.csv")

# Ensure local dir exists
os.makedirs(LOCAL_DIR, exist_ok=True)

def sendDiscordNotification(message, level="error"):
    if level.lower() == "error":
        emoji = "⚠️"
        title = "**Stock Sprite CSV error**"
    else:
        emoji = "ℹ️"
        title = "**Stock Sprite CSV success**"

    payload = {
        "content": f"{emoji} {title}\n{message}"
    }

    try:
        response = requests.post(DISCORD_WEBHOOK_URL, json=payload, timeout=10)
        response.raise_for_status()
    except Exception as e:
        logging.error(f"Failed to send Discord notification: {e}")

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(message)s',
    datefmt='%Y-%m-%d-%H:%M:%S',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)

def validateHttpResponse(response, source_name=""):
    """
    Validates HTTP response against edge cases:
    - HTTP status errors
    - Empty content (0 bytes)
    - Unexpected redirects to HTML web/login/error pages
    - HTML error/maintenance pages returned with 200 OK
    Supports both CSV and XML data feeds.
    """
    response.raise_for_status()

    # Check for empty response body
    if not response.content or len(response.content.strip()) == 0:
        raise Exception(f"{source_name} received empty response (0 bytes)")

    content_trimmed = response.content.strip().lower()
    is_html_page = content_trimmed.startswith(b"<!doctype html") or content_trimmed.startswith(b"<html")

    # Check if a redirect led to an HTML error/login page
    if response.history and is_html_page:
        redirect_chain = " -> ".join([f"{r.status_code} ({r.url})" for r in response.history])
        raise Exception(f"{source_name} unexpected redirect chain [{redirect_chain}] ending in HTML page: {response.url}")

    # Check if an HTML error/maintenance page was returned instead of CSV or XML
    if is_html_page:
        raise Exception(f"{source_name} received HTML web page instead of CSV/XML data")

def checkContentUnchanged(file_path, new_content_bytes, provider_name):
    """
    Checks if newly downloaded content matches the existing file on disk.
    Logs to the log file if unchanged without affecting Discord messages or execution.
    """
    if os.path.exists(file_path):
        try:
            with open(file_path, 'rb') as f:
                if f.read() == new_content_bytes:
                    logging.info(f"{provider_name} content on disk is identical to downloaded content (file unchanged).")
        except Exception as e:
            logging.warning(f"Could not compare existing {provider_name} file: {e}")

def getCromwellCsv():
    transport = None
    try:
        # Connect and download latest file
        private_key = paramiko.RSAKey.from_private_key_file(CROMWELL_SFTP_KEY)
        transport = paramiko.Transport((CROMWELL_SFTP_HOST, 22))
        transport.connect(username=CROMWELL_SFTP_USER, pkey=private_key)
        sftp = paramiko.SFTPClient.from_transport(transport)

        files = [f for f in sftp.listdir(CROMWELL_SFTP_REMOTE_DIR) if not f.startswith('.')]
        if not files:
            raise Exception("No files found on SFTP server")

        files.sort()
        latest_file = files[-1]
        
        existing_cromwell_data = None
        if os.path.exists(CROMWELL_FILE_RAW):
            try:
                with open(CROMWELL_FILE_RAW, 'rb') as f:
                    existing_cromwell_data = f.read()
            except Exception:
                pass

        # Download to raw file
        sftp.get(os.path.join(CROMWELL_SFTP_REMOTE_DIR, latest_file), CROMWELL_FILE_RAW)

        if existing_cromwell_data is not None:
            try:
                with open(CROMWELL_FILE_RAW, 'rb') as f:
                    if f.read() == existing_cromwell_data:
                        logging.info("Cromwell content on disk is identical to downloaded content (file unchanged).")
            except Exception:
                pass

        # Convert raw file to final format
        with open(CROMWELL_FILE_FINAL, "w") as outfile:
            subprocess.run(
                ["csvformat", "-D", ";", "-d", ",", CROMWELL_FILE_RAW],
                stdout=outfile,
                check=True
            )

        if not os.path.exists(CROMWELL_FILE_FINAL) or os.path.getsize(CROMWELL_FILE_FINAL) == 0:
            raise Exception("Converted Cromwell CSV output file is empty (0 bytes)")

        logging.info("Cromwell csv data downloaded successfully")
        return True
    except subprocess.CalledProcessError as e:
        errorMsg = f"Failed to convert cromwell csv (csvformat error): {str(e)}"
        logging.error(errorMsg)
        sendDiscordNotification(errorMsg)
        return False
    except Exception as e:
        errorMsg = f"Failed to download cromwell csv data: {str(e)}"
        logging.error(errorMsg)
        sendDiscordNotification(errorMsg)
        return False
    finally:
        if transport: transport.close()

def getMagictoolsCsv():
    try:
        # Download the file
        response = requests.get(MAGICTOOLS_URL, verify=False, timeout=30)
        validateHttpResponse(response, "Magictools")
        
        checkContentUnchanged(MAGICTOOLS_FILE_RAW, response.content, "Magictools")

        with open(MAGICTOOLS_FILE_RAW, 'wb') as f:
            f.write(response.content)
        
        # Execute csvformat command
        with open(MAGICTOOLS_FILE_FINAL, "w") as outfile:
            subprocess.run(
                ["csvformat", "-D", ";", "-d", ";", MAGICTOOLS_FILE_RAW],
                stdout=outfile,
                check=True
            )

        if not os.path.exists(MAGICTOOLS_FILE_FINAL) or os.path.getsize(MAGICTOOLS_FILE_FINAL) == 0:
            raise Exception("Converted Magictools CSV output file is empty (0 bytes)")

        logging.info("Magictools csv data downloaded successfully")
        return True
    except subprocess.CalledProcessError as e:
        errorMsg = f"Failed to convert magictools csv (csvformat error): {str(e)}"
        logging.error(errorMsg)
        sendDiscordNotification(errorMsg)
        return False
    except Exception as e:
        errorMsg = f"Failed to download magictools csv data: {str(e)}"
        logging.error(errorMsg)
        sendDiscordNotification(errorMsg)
        return False

def getMadalbalCsv():
    try:
        response = requests.get(MADALBAL_URL, verify=False, timeout=30)
        validateHttpResponse(response, "Madalbal")
        
        checkContentUnchanged(MADALBAL_FILE_RAW, response.content, "Madalbal")

        with open(MADALBAL_FILE_RAW, 'wb') as f:
            f.write(response.content)

        # xpath=".//product" ensures we target every product entry in the file
        df = pandas.read_xml(MADALBAL_FILE_RAW, xpath=".//product")
        # Select the specific columns and rename them
        # Note: 'id' is automatically picked up from the <product id="..."> attribute
        df_output = df[['id', 'stockAmount']].copy()
        # Rename columns to desired CSV headers
        df_output.columns = ['sku', 'stock']
        df_output.to_csv(MADALBAL_FILE_FINAL, index=False, encoding='utf-8', sep=';')

        if not os.path.exists(MADALBAL_FILE_FINAL) or os.path.getsize(MADALBAL_FILE_FINAL) == 0:
            raise Exception("Converted Madalbal CSV output file is empty (0 bytes)")

        logging.info("Madalbal csv data downloaded successfully")
        return True
    except Exception as e:
        errorMsg = f"Failed to download or convert Madalbal csv data: {str(e)}"
        logging.error(errorMsg)
        sendDiscordNotification(errorMsg)
        return False
        
def getStanleyCsv():
    try:
        response = requests.get(STANLEY_URL, verify=False, timeout=30)
        validateHttpResponse(response, "Stanley")
        
        checkContentUnchanged(STANLEY_FILE_RAW, response.content, "Stanley")

        with open(STANLEY_FILE_RAW, 'wb') as f:
            f.write(response.content)

        # xpath=".//product" ensures we target every product entry in the file
        df = pandas.read_xml(STANLEY_FILE_RAW, xpath=".//product")
        # Map Stanley XML fields to standardized CSV headers
        df_output = df[['product.sku', 'product.quantity']].copy()
        # Rename columns to desired CSV headers
        df_output.columns = ['sku', 'stock']
        df_output.to_csv(STANLEY_FILE_FINAL, index=False, encoding='utf-8', sep=';')

        if not os.path.exists(STANLEY_FILE_FINAL) or os.path.getsize(STANLEY_FILE_FINAL) == 0:
            raise Exception("Converted Stanley CSV output file is empty (0 bytes)")

        logging.info("Stanley csv data downloaded successfully")
        return True
    except Exception as e:
        errorMsg = f"Failed to download or convert Stanley csv data: {str(e)}"
        logging.error(errorMsg)
        sendDiscordNotification(errorMsg)
        return False

def getDepiendCsv():
    try:
        # Download the file
        response = requests.get(DEPIEND_URL, verify=False, timeout=30)
        validateHttpResponse(response, "Depiend")
        
        checkContentUnchanged(DEPIEND_FILE_RAW, response.content, "Depiend")

        with open(DEPIEND_FILE_RAW, 'wb') as f:
            f.write(response.content)

        # convert the DEPIEND_FILE_RAW ; separated csv file to , separeted. DEPIEND_FILE_RAW is a CSV file, not XML.
        with open(DEPIEND_FILE_FINAL, "w") as outfile:
            subprocess.run(
                ["csvformat", "-D", ";", "-d", ";", DEPIEND_FILE_RAW],
                stdout=outfile,
                check=True
            )

        if not os.path.exists(DEPIEND_FILE_FINAL) or os.path.getsize(DEPIEND_FILE_FINAL) == 0:
            raise Exception("Converted Depiend CSV output file is empty (0 bytes)")

        logging.info("Depiend csv data downloaded successfully")
        return True
    except subprocess.CalledProcessError as e:
        errorMsg = f"Failed to convert Depiend csv (csvformat error): {str(e)}"
        logging.error(errorMsg)
        sendDiscordNotification(errorMsg)
        return False
    except Exception as e:
        errorMsg = f"Failed to download Depiend csv data: {str(e)}"
        logging.error(errorMsg)
        sendDiscordNotification(errorMsg)
        return False

if __name__ == "__main__":
    providers = [
        ("Cromwell", getCromwellCsv),
        ("Magictools", getMagictoolsCsv),
        ("Madalbal", getMadalbalCsv),
        ("Depiend", getDepiendCsv),
        ("Stanley", getStanleyCsv),
    ]

    results = {}
    for name, func in providers:
        success = func()
        results[name] = "OK" if success else "ERROR"

    summary_details = ", ".join([f"{name}: {status}" for name, status in results.items()])
    summary_message = f"CSV update session finished. {summary_details}"
    
    all_ok = all(status == "OK" for status in results.values())
    level = "info" if all_ok else "error"

    logging.info(summary_message)
    sendDiscordNotification(summary_message, level=level)