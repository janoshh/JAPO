package com.example.janosh.japoapp;

import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.widget.ImageView;

public class MainActivity_show extends AppCompatActivity {

    public static final int REQUEST_CAPTURE = 1;
    ImageView result_photo;
                                                                            //LOCALSTORAGE gebruiken voor token op te slagen
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main_show);
    }
}


