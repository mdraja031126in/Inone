package com.inone.studio

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebChromeClient.FileChooserParams
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.effect.Brightness
import androidx.media3.effect.Contrast
import androidx.media3.effect.HslAdjustment
import androidx.media3.effect.ScaleAndRotateTransformation
import androidx.media3.effect.SpeedChangeEffect
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var activeTransformer: Transformer? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private val channelId = "inone_export_channel"

    // 1. Runtime Permissions Launcher (Video, Image, Audio, Notifications, Storage)
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val grantedAll = results.values.all { it }
        val msg = if (grantedAll) "All media & notification permissions granted" else "Some permissions were denied"
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        sendJs("window.onPermissionsResult", JSONObject(results as Map<*, *>).toString())
    }

    // 2. WebView <input type="file"> Handler
    private val webFileChooser = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = fileChooserCallback
        fileChooserCallback = null
        if (callback == null) return@registerForActivityResult
        val data = result.data
        val uris = if (result.resultCode == RESULT_OK && data != null) {
            val clip = data.clipData
            when {
                clip != null -> Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                data.data != null -> arrayOf(data.data!!)
                else -> null
            }
        } else null
        callback.onReceiveValue(uris)
    }

    // 3. Native Multi-Video Picker for Timeline & Export
    private val multiVideoPicker = registerForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments()
    ) { uris ->
        if (uris.isNotEmpty()) {
            val arr = JSONArray()
            uris.forEach { uri ->
                try {
                    contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                } catch (_: Exception) {}
                arr.put(uri.toString())
            }
            val quoted = JSONObject.quote(arr.toString())
            webView.evaluateJavascript("window.onNativeVideosPicked && window.onNativeVideosPicked($quoted)", null)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()
        requestAllRequiredPermissions()

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
        }

        webView.addJavascriptInterface(NativeBridge(), "InOneNative")
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                return try {
                    val intent = fileChooserParams?.createIntent()?.apply {
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    } ?: return false
                    webFileChooser.launch(intent)
                    true
                } catch (_: Exception) {
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = null
                    false
                }
            }
        }
        webView.loadUrl("file:///android_asset/www/index.html")
    }

    private fun requestAllRequiredPermissions() {
        val perms = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.READ_MEDIA_VIDEO)
            perms.add(Manifest.permission.READ_MEDIA_IMAGES)
            perms.add(Manifest.permission.READ_MEDIA_AUDIO)
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            perms.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
                perms.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Video Export & Render Status",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Shows progress and completion of exported videos and files"
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun showNotification(title: String, body: String, id: Int = 1001) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notif = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()
        nm.notify(id, notif)
    }

    inner class NativeBridge {
        @JavascriptInterface fun platform(): String = "android"
        @JavascriptInterface fun appVersion(): String = "1.5.0-PRO"

        @JavascriptInterface fun requestPermissions() {
            runOnUiThread { requestAllRequiredPermissions() }
        }

        @JavascriptInterface fun toast(message: String) {
            runOnUiThread { Toast.makeText(this@MainActivity, message.take(140), Toast.LENGTH_SHORT).show() }
        }

        @JavascriptInterface fun pickVideos() {
            runOnUiThread { multiVideoPicker.launch(arrayOf("video/*")) }
        }

        @JavascriptInterface fun exportProVideo(configJson: String) {
            runOnUiThread { beginProExport(configJson) }
        }

        @JavascriptInterface fun cancelExport() {
            runOnUiThread {
                activeTransformer?.cancel()
                activeTransformer = null
                showNotification("Export Cancelled", "Video rendering was stopped.")
            }
        }

        @JavascriptInterface fun saveDownloadFile(fileName: String, mimeType: String, base64Data: String) {
            Thread {
                val saved = saveToDownloads(fileName, mimeType, base64Data)
                runOnUiThread {
                    if (saved != null) {
                        Toast.makeText(this@MainActivity, "Saved to Downloads: $fileName", Toast.LENGTH_LONG).show()
                        showNotification("File Saved", "$fileName saved in Downloads")
                    } else {
                        Toast.makeText(this@MainActivity, "Failed to save $fileName", Toast.LENGTH_SHORT).show()
                    }
                }
            }.start()
        }

        @JavascriptInterface fun requestAI(provider: String, endpoint: String, model: String, apiKey: String, promptData: String) {
            Thread { performAIRequest(provider, endpoint, model, apiKey, promptData) }.start()
        }
    }

    private fun beginProExport(configJson: String) {
        try {
            val cfg = JSONObject(configJson)
            val clipsArr = cfg.getJSONArray("clips")
            if (clipsArr.length() == 0) {
                sendJs("window.onNativeExportError", "No video clips selected for export.")
                return
            }

            val editedItems = mutableListOf<EditedMediaItem>()
            for (i in 0 until clipsArr.length()) {
                val item = clipsArr.getJSONObject(i)
                val uri = Uri.parse(item.getString("uri"))
                val startMs = item.optLong("startMs", 0L)
                val endMs = item.optLong("endMs", 0L)
                val speed = item.optDouble("speed", 1.0).toFloat().coerceIn(0.25f, 4.0f)
                val brightness = item.optDouble("brightness", 0.0).toFloat().coerceIn(-1f, 1f)
                val contrast = item.optDouble("contrast", 0.0).toFloat().coerceIn(-1f, 1f)
                val saturation = item.optDouble("saturation", 0.0).toFloat().coerceIn(-100f, 100f)
                val rotation = item.optDouble("rotation", 0.0).toFloat()

                val mediaBuilder = MediaItem.Builder().setUri(uri)
                if (endMs > startMs && startMs >= 0) {
                    mediaBuilder.setClippingConfiguration(
                        MediaItem.ClippingConfiguration.Builder()
                            .setStartPositionMs(startMs)
                            .setEndPositionMs(endMs)
                            .build()
                    )
                }

                val videoEffects = mutableListOf<Effect>()
                val audioProcessors = mutableListOf<AudioProcessor>()

                if (brightness != 0f) videoEffects.add(Brightness(brightness))
                if (contrast != 0f) videoEffects.add(Contrast(contrast))
                if (saturation != 0f) {
                    videoEffects.add(HslAdjustment.Builder().adjustSaturation(saturation).build())
                }
                if (rotation != 0f) {
                    videoEffects.add(ScaleAndRotateTransformation.Builder().setRotationDegrees(rotation).build())
                }
                if (speed != 1.0f) {
                    videoEffects.add(SpeedChangeEffect(speed))
                    val sonic = SonicAudioProcessor().apply { setSpeed(speed) }
                    audioProcessors.add(sonic)
                }

                val editedItem = EditedMediaItem.Builder(mediaBuilder.build())
                    .setEffects(Effects(audioProcessors, videoEffects))
                    .build()
                editedItems.add(editedItem)
            }

            val sequence = EditedMediaItemSequence.Builder(editedItems).build()
            val composition = Composition.Builder(sequence).build()

            val dir = getExternalFilesDir(Environment.DIRECTORY_MOVIES) ?: filesDir
            if (!dir.exists()) dir.mkdirs()
            val outFile = File(dir, "INONE_PRO_${System.currentTimeMillis()}.mp4")

            showNotification("Rendering Video...", "IN ONE Studio Pro is exporting your MP4 video.")
            sendJs("window.onNativeExportProgress", "Rendering ${editedItems.size} clip(s) with effects...")

            val transformer = Transformer.Builder(this)
                .addListener(object : Transformer.Listener {
                    override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                        activeTransformer = null
                        val publishedUri = publishVideoToGallery(outFile)
                        val resultPath = publishedUri?.toString() ?: outFile.absolutePath
                        showNotification("Export Complete!", "Saved to Movies/IN ONE Studio")
                        sendJs("window.onNativeExportComplete", resultPath)
                    }

                    override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
                        activeTransformer = null
                        showNotification("Export Failed", exportException.message ?: "Unknown render error")
                        sendJs("window.onNativeExportError", exportException.message ?: "Export failed.")
                    }
                })
                .build()

            activeTransformer = transformer
            transformer.start(composition, outFile.absolutePath)

        } catch (e: Exception) {
            sendJs("window.onNativeExportError", e.message ?: "Failed to start Pro export.")
        }
    }

    private fun publishVideoToGallery(file: File): Uri? {
        if (!file.exists()) return null
        return try {
            val values = ContentValues().apply {
                put(MediaStore.Video.Media.DISPLAY_NAME, file.name)
                put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
                if (Build.VERSION.SDK_INT >= 29) {
                    put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/IN ONE Studio")
                    put(MediaStore.Video.Media.IS_PENDING, 1)
                }
            }
            val uri = contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values) ?: return null
            contentResolver.openOutputStream(uri)?.use { out ->
                FileInputStream(file).use { input -> input.copyTo(out) }
            }
            if (Build.VERSION.SDK_INT >= 29) {
                values.clear()
                values.put(MediaStore.Video.Media.IS_PENDING, 0)
                contentResolver.update(uri, values, null, null)
            }
            file.delete()
            uri
        } catch (_: Exception) { null }
    }

    private fun saveToDownloads(fileName: String, mimeType: String, base64Data: String): Uri? {
        return try {
            val cleanBase64 = base64Data.substringAfter(",")
            val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
            if (Build.VERSION.SDK_INT >= 29) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/IN ONE Studio")
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return null
                contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                uri
            } else {
                val dlDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                if (!dlDir.exists()) dlDir.mkdirs()
                val f = File(dlDir, fileName)
                f.writeBytes(bytes)
                Uri.fromFile(f)
            }
        } catch (_: Exception) { null }
    }

    private fun sendJs(function: String, payload: String) {
        val quoted = JSONObject.quote(payload)
        runOnUiThread { webView.evaluateJavascript("$function($quoted)", null) }
    }

    private fun performAIRequest(provider: String, endpointText: String, modelText: String, apiKey: String, promptData: String) {
        var connection: HttpURLConnection? = null
        try {
            require(apiKey.isNotBlank()) { "API key is required." }
            val data = JSONObject(promptData)
            val prompt = data.optString("prompt", "Review this video.")
            val model = modelText.ifBlank {
                when (provider) {
                    "gemini" -> "gemini-2.0-flash"
                    "anthropic" -> "claude-3-5-sonnet-latest"
                    else -> "gpt-4o-mini"
                }
            }
            val endpoint = when (provider) {
                "gemini" -> endpointText.ifBlank { "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent" }
                "anthropic" -> endpointText.ifBlank { "https://api.anthropic.com/v1/messages" }
                else -> endpointText.ifBlank { "https://api.openai.com/v1/chat/completions" }
            }
            val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 25000
                readTimeout = 60000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
            connection = conn
            val requestBody = when (provider) {
                "gemini" -> {
                    conn.setRequestProperty("x-goog-api-key", apiKey)
                    JSONObject().put("contents", JSONArray().put(
                        JSONObject().put("parts", JSONArray().put(JSONObject().put("text", prompt)))
                    ))
                }
                "anthropic" -> {
                    conn.setRequestProperty("x-api-key", apiKey)
                    conn.setRequestProperty("anthropic-version", "2023-06-01")
                    JSONObject().put("model", model).put("max_tokens", 1600)
                        .put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", prompt)))
                }
                else -> {
                    conn.setRequestProperty("Authorization", "Bearer $apiKey")
                    JSONObject().put("model", model).put("max_tokens", 1600)
                        .put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", prompt)))
                }
            }
            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(requestBody.toString()) }
            val status = conn.responseCode
            val raw = (if (status in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            if (status !in 200..299) throw IllegalStateException("HTTP $status: ${raw.take(400)}")
            val response = JSONObject(raw)
            val answer = when (provider) {
                "gemini" -> response.optJSONArray("candidates")?.optJSONObject(0)?.optJSONObject("content")?.optJSONArray("parts")?.optJSONObject(0)?.optString("text")
                "anthropic" -> response.optJSONArray("content")?.optJSONObject(0)?.optString("text")
                else -> response.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")?.optString("content")
            }.orEmpty()
            val quoted = JSONObject.quote(answer.take(12000))
            runOnUiThread { webView.evaluateJavascript("window.onAIResponse && window.onAIResponse(true,$quoted)", null) }
        } catch (e: Exception) {
            val quoted = JSONObject.quote(e.message ?: "AI error")
            runOnUiThread { webView.evaluateJavascript("window.onAIResponse && window.onAIResponse(false,$quoted)", null) }
        } finally {
            connection?.disconnect()
        }
    }

    override fun onDestroy() {
        activeTransformer?.cancel()
        fileChooserCallback?.onReceiveValue(null)
        super.onDestroy()
    }
}
