package com.example.janosh.japoapp;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.AsyncTask;
import android.util.Base64;
import android.util.Log;

import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.ClientProtocolException;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.mime.content.StringBody;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.util.EntityUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Created by Janosh on 19/12/2016.
 */

public class UploadFileToServer extends AsyncTask<Void, Integer, String> {
    long totalSize = 0;
    String filePath, token, user, cName, tag, fName;
    int statusCode;

    public UploadFileToServer(String filePath, String cName, String tag, String token, String user, String fName) {
        this.filePath = filePath;
        this.cName = cName;
        this.tag = tag;
        this.token = token;
        this.user = user;
        this.fName = fName;
    }

    @Override
    protected String doInBackground(Void... params) {
        return uploadFile();
    }

    @SuppressWarnings("deprecation")
    private String uploadFile() {
        String responseString = null;

        HttpClient httpclient = new DefaultHttpClient();
        HttpPost httppost = new HttpPost(Config.FILE_UPLOAD_URL);

        try {
            AndroidMultiPartEntity entity = new AndroidMultiPartEntity(
                    new AndroidMultiPartEntity.ProgressListener() {

                        @Override
                        public void transferred(long num) {
                            publishProgress((int) ((num / (float) totalSize) * 100));
                        }
                    });

            //File sourceFile = new File(filePath);

            Bitmap bm = BitmapFactory.decodeFile(filePath);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bm.compress(Bitmap.CompressFormat.PNG, 100, baos); //bm is the bitmap object
            byte[] b = baos.toByteArray();

            String encodedImage = Base64.encodeToString(b, Base64.DEFAULT);
            //Log.d("encoded image: ", encodedImage);

            // Adding encoded file data to http body
            entity.addPart("file", new StringBody(encodedImage));
            //entity.addPart("file", new FileBody(sourceFile));
            // Adding token to http body
            entity.addPart("token", new StringBody(token));     //token voor permission
            entity.addPart("token", new StringBody(fName));
            //set header with extra info
            totalSize = entity.getContentLength();

            httppost.setHeader("x-access-token", token);        //token voor permission
            httppost.setHeader("user",user);                    //email
            httppost.setHeader("customfilename",cName);         //customfilename
            httppost.setHeader("tags",tag);                     //tag
            httppost.setHeader("file-size", totalSize+"");      //filesize voor amazon S3
            httppost.setHeader("filename", fName);                   //faliname
            Log.d("fileSize: ", totalSize+"");

            // Log.d("FILENAME: ",fName);

            httppost.setEntity(entity);

            // Making server call
            HttpResponse response = httpclient.execute(httppost);
            HttpEntity r_entity = response.getEntity();

            statusCode = response.getStatusLine().getStatusCode();
            if (statusCode == 200) {
                responseString = EntityUtils.toString(r_entity);
            } else {
                responseString = "Error occurred! Http Status Code: " + statusCode;
            }

        } catch (ClientProtocolException e) {
            responseString = e.toString();
        } catch (IOException e) {
            responseString = e.toString();
        }
        return responseString;
    }

    @Override
    protected void onPostExecute(String result) {
        Log.e("Response from server: ", result);
        super.onPostExecute(result);
        if (statusCode == 200) {
            MainActivity.onRes();   //clear edittext,  set imgtxt, set pgbar invisible
        } else {
            MainActivity.onBadRes();    //set imgtxt, set pgbar invisible
        }
    }
}