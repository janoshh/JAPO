package com.example.janosh.japoapp;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.support.v7.app.AlertDialog;
import android.support.v7.app.AppCompatActivity;
import android.util.Log;
import android.view.View;
import android.widget.EditText;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.toolbox.Volley;

import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity_login extends AppCompatActivity {

    EditText email;
    EditText pass;

    String passwd;
    String user;
    boolean autoLogin;
                                                                            //LOCALSTORAGE gebruiken voor token op te slagen
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main_login);

        email = (EditText) findViewById(R.id.txtMail);
        pass = (EditText) findViewById(R.id.txtPass);

        // load token and username
        SharedPreferences settings = getSharedPreferences("validation", MODE_PRIVATE);
        passwd = settings.getString("pass", "Error loading pass");
        user = settings.getString("user", "Error loading user");

        if (passwd != "Error loading pass" && user != "Error loading user") {
            Log.d("login: ","automated");
            autoLogin = true;
            postLogin();
        }
        else {
            Log.d("login: ","not automated login");
            autoLogin = false;
        }
    }

    public void login(View v) {
        postLogin();
    }

    public void postLogin(){
        final String name = email.getText().toString();
        final String password = pass.getText().toString();
        //Log.d("name: ",name);
        //Log.d("pass: ",password);

        Response.Listener<String> responseListener = new Response.Listener<String>(){
            @Override
            public void onResponse(String response){
                Log.d("response: ", response);
                try {

                    JSONObject jsonResponse = new JSONObject(response);
                    boolean success = jsonResponse.getBoolean("success");

                    if (success){
                        String token = jsonResponse.getString("token");
                        Intent intent = new Intent(MainActivity_login.this, MainActivity.class);
                        MainActivity_login.this.startActivity(intent);

                        SharedPreferences settings = getSharedPreferences("validation", MODE_PRIVATE);
                        SharedPreferences.Editor editor = settings.edit();
                        editor.putString("token", token);
                        editor.putString("user", name);
                        editor.putString("pass", password);
                        editor.commit();

                    }else {
                        AlertDialog.Builder builder =  new AlertDialog.Builder(MainActivity_login.this);
                        builder.setMessage("Create an account for free on the website!").setNegativeButton("Retry", null).create().show();
                    }

                }catch (JSONException e){
                    e.printStackTrace();
                }
            }
        };

        if (autoLogin) {
            LoginRequest loginRequest = new LoginRequest(user, passwd, responseListener);
            RequestQueue queue = Volley.newRequestQueue(MainActivity_login.this);
            queue.add(loginRequest);
        }
        else {
            LoginRequest loginRequest = new LoginRequest(name, password, responseListener);
            RequestQueue queue = Volley.newRequestQueue(MainActivity_login.this);
            queue.add(loginRequest);
        }
    }
}


