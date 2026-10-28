package com.xmlflow.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().addJavascriptInterface(new AndroidNativeBridge(), "AndroidNative");
        }
    }

    public class AndroidNativeBridge {

        @JavascriptInterface
        public void printPage(final String jobName) {
            runOnUiThread(() -> {
                try {
                    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                    if (webView == null) {
                        Toast.makeText(MainActivity.this, "No se pudo acceder a la vista de impresión", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (printManager == null) {
                        Toast.makeText(MainActivity.this, "Servicio de impresión no disponible en este dispositivo", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    String docName = (jobName != null && !jobName.trim().isEmpty())
                            ? jobName.trim()
                            : "Cedula_Contable_XmlFlow";

                    PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(docName);

                    PrintAttributes.Builder builder = new PrintAttributes.Builder();
                    builder.setMediaSize(PrintAttributes.MediaSize.NA_LETTER.asLandscape());
                    builder.setColorMode(PrintAttributes.COLOR_MODE_COLOR);

                    printManager.print(docName, printAdapter, builder.build());
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Error al abrir impresión/PDF: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void saveBase64File(final String base64Data, final String fileName, final String mimeType) {
            runOnUiThread(() -> {
                try {
                    if (base64Data == null || base64Data.isEmpty()) {
                        Toast.makeText(MainActivity.this, "El archivo generado está vacío", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    String cleanBase64 = base64Data.contains(",")
                            ? base64Data.substring(base64Data.indexOf(",") + 1)
                            : base64Data;

                    byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
                    String safeFileName = (fileName != null && !fileName.trim().isEmpty())
                            ? fileName.trim()
                            : "Cedula_Contable_XmlFlow.xlsx";
                    String safeMime = (mimeType != null && !mimeType.trim().isEmpty())
                            ? mimeType.trim()
                            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

                    // 1. Guardar directamente en la carpeta pública de Descargas (Android 10+)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        try {
                            ContentValues values = new ContentValues();
                            values.put(MediaStore.Downloads.DISPLAY_NAME, safeFileName);
                            values.put(MediaStore.Downloads.MIME_TYPE, safeMime);
                            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                            ContentResolver resolver = getContentResolver();
                            Uri downloadUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                            if (downloadUri != null) {
                                try (OutputStream os = resolver.openOutputStream(downloadUri)) {
                                    if (os != null) {
                                        os.write(fileBytes);
                                        os.flush();
                                    }
                                }
                            }
                        } catch (Exception ignored) {
                            // Si falla MediaStore, aún tenemos el archivo en caché para compartir/abrir con FileProvider
                        }
                    }

                    // 2. Guardar copia en caché de la app y abrir menú nativo con FileProvider
                    File cacheFile = new File(getCacheDir(), safeFileName);
                    try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                        fos.write(fileBytes);
                        fos.flush();
                    }

                    Uri fileUri = FileProvider.getUriForFile(
                            MainActivity.this,
                            getPackageName() + ".fileprovider",
                            cacheFile
                    );

                    Toast.makeText(
                            MainActivity.this,
                            "Guardado en Descargas: " + safeFileName,
                            Toast.LENGTH_LONG
                    ).show();

                    // Intent para abrir directamente en Excel / visor de hojas de cálculo o compartir
                    Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                    viewIntent.setDataAndType(fileUri, safeMime);
                    viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

                    Intent shareIntent = new Intent(Intent.ACTION_SEND);
                    shareIntent.setType(safeMime);
                    shareIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                    shareIntent.putExtra(Intent.EXTRA_SUBJECT, safeFileName);
                    shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                    Intent chooser = Intent.createChooser(shareIntent, "Abrir o guardar " + safeFileName);
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{viewIntent});
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(chooser);

                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Error al exportar archivo: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }
    }
}
