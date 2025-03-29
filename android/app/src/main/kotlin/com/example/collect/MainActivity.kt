package com.example.collect

import android.content.Intent
import android.net.Uri
import androidx.annotation.NonNull
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.example.collect/share"
    private lateinit var channel: MethodChannel

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        when (intent.action) {
            Intent.ACTION_SEND -> {
                if (intent.type?.startsWith("text/") == true) {
                    val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
                    sharedText?.let {
                        channel.invokeMethod("onTextReceived", it)
                    }
                } else {
                    val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                    uri?.let {
                        val file = saveSharedFile(it, "/storage/emulated/0/collection")
                        file?.let {
                            channel.invokeMethod("onFileReceived", it.absolutePath)
                        }
                    }
                }
            }
        }
    }

    private fun saveSharedFile(uri: Uri, customDir: String): File? {
        try {
            val collectionDir = File(customDir)
            if (!collectionDir.exists()) {
                collectionDir.mkdirs()
            }
            
            val inputStream = contentResolver.openInputStream(uri)
            val fileName = "${System.currentTimeMillis()}_${uri.lastPathSegment}"
            val file = File(collectionDir, fileName)
            
            inputStream?.copyTo(FileOutputStream(file))
            inputStream?.close()
            
            return file
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }
}
