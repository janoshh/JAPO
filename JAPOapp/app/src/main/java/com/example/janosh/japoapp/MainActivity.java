package com.example.janosh.japoapp;

import java.io.File;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.support.v4.app.ActivityCompat;
import android.support.v7.app.AppCompatActivity;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends AppCompatActivity {

    int REQUEST_CODE = 1;
    private static final int REQUEST_CODE_STORAGE = 1;

    String fileName, fname;
    String fileType = ".jpg";
    String path;
    String token;
    String user;

    File tempStore = Environment.getExternalStorageDirectory();
    String tempExtStore = tempStore + "/JAPO";
    File extStore = new File(tempExtStore);

    static TextView imgTxt;
    static Button upload;
    static Button capture;
    static EditText cName;
    static EditText tag;
    static ProgressBar pgBar;
    static TextView viewDoc;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        capture = (Button)findViewById(R.id.btnCapture);
        pgBar = (ProgressBar)findViewById(R.id.progressBar);
        upload = (Button)findViewById(R.id.btnUpload);
        imgTxt = (TextView)findViewById(R.id.image_text);
        cName = (EditText)findViewById(R.id.customName);
        tag = (EditText)findViewById(R.id.tagName);
        viewDoc = (TextView)findViewById(R.id.txtDocuments);

        upload.setEnabled(false);
        cName.setEnabled(false);
        tag.setEnabled(false);
        pgBar.setVisibility(View.INVISIBLE);

        //welcome
        Context context = getApplicationContext();
        CharSequence text = "Welcome!";
        int duration = Toast.LENGTH_SHORT;

        Toast toast = Toast.makeText(context, text, duration);
        toast.show();

        //permission to write to external storage at runtime (since android 6)
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            // Request missing write/read storage permission.
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE, Manifest.permission.READ_EXTERNAL_STORAGE}, REQUEST_CODE_STORAGE);
        } else {
            // write storage permission has been granted, continue as usual.
            Log.d("PERMISSION: ", "granted");
        }

        if(!hasCamera()){
            capture.setEnabled(false);
        }

        capture.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                // capture picture
                captureImage();
            }
        });

        upload.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                //upload image after image is taken
                //arguments: filePath
                String custom = cName.getText().toString();
                String tagname = tag.getText().toString();
                if(custom == null){
                    custom = fileName;
                }
                if (tagname == null){
                    tagname = "";
                }

                pgBar.setVisibility(View.VISIBLE);
                imgTxt.setText("Uploading...");
                capture.setEnabled(false);
                cName.setEnabled(false);
                tag.setEnabled(false);
                viewDoc.setEnabled(true);
                // load token and username
                SharedPreferences settings = getSharedPreferences("validation", MODE_PRIVATE);
                token = settings.getString("token", "Error loading token");
                user = settings.getString("user", "Error loading user");

                if (token != "Error loading token" && user != "Error loading user") {
                    new UploadFileToServer(path, custom, tagname, token, user, fname).execute();
                }
                else {
                    Log.d("ERROR: ", "unable to find user or token");
                }
            }
        });

        //go to documents activity and pass token and username(email)
        viewDoc.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(MainActivity.this, MainActivity_show.class);
                MainActivity.this.startActivity(intent);
            }
        });
    }

    //callback user input on permission request
    public void onRequestPermissionsResult(int requestCodeStorage, int requestcodeOverLay, String[] permissions, int[] grantResults) {
        if (requestCodeStorage == REQUEST_CODE_STORAGE) {
            if(grantResults.length == 2 && grantResults[0] == PackageManager.PERMISSION_GRANTED && grantResults[1] == PackageManager.PERMISSION_GRANTED) {
                // success!
            } else {
                imgTxt.setText("You have to give write/read permissions for proper working of the application");
                upload.setEnabled(false);
                capture.setEnabled(false);
                cName.setEnabled(false);
                tag.setEnabled(false);
            }
        }
    }

    public boolean hasCamera(){
        return getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY);
    }

     //Launching camera app to capture image
    private void captureImage() {
        Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        File file = saveFile();
        i.putExtra(MediaStore.EXTRA_OUTPUT, Uri.fromFile(file));
        startActivityForResult(i, REQUEST_CODE);
    }

    //save file
    public File saveFile(){
        Long tsLong = System.currentTimeMillis()/1000;
        String ts = tsLong.toString();
        String tempfpath = "/";
        fileName = tempfpath + "IMG_" + ts + fileType;
        fname = "IMG" + ts + fileType;
        File folder = tempStore;
        if(!folder.exists()){
            folder.mkdir();
        }
        File img_file = new File(folder, fileName);
        return img_file;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data){
        if(requestCode == REQUEST_CODE && resultCode == RESULT_OK){
            path = tempStore + fileName;
            imgTxt.setText("Image saved! Ready to upload");
            upload.setEnabled(true);
            cName.setEnabled(true);
            tag.setEnabled(true);
            Log.d("path: ",path);
        }else{
            imgTxt.setText("No image taken");
            Log.d("ERROR: ", "NO IMAGE TAKEN");
        }
    }

    //on result http post
    public static void onRes(){
        pgBar.setVisibility(View.INVISIBLE);
        upload.setEnabled(false);
        capture.setEnabled(true);
        viewDoc.setEnabled(true);
        imgTxt.setText("Upload success!");
        cName.setText("");
        tag.setText("");
    }

    public static void onBadRes(){
        pgBar.setVisibility(View.INVISIBLE);
        imgTxt.setText("Upload failed! Try again");
        capture.setEnabled(true);
        cName.setEnabled(true);
        tag.setEnabled(true);
        viewDoc.setEnabled(true);
    }

    public static void limitReached(){
        pgBar.setVisibility(View.INVISIBLE);
        imgTxt.setText("Limit reached.\nCreate a premium account on our website!");
        capture.setEnabled(true);
        cName.setEnabled(true);
        tag.setEnabled(true);
        viewDoc.setEnabled(true);
    }
}