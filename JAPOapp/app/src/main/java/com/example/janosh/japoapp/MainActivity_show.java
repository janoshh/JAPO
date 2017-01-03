package com.example.janosh.japoapp;

import android.app.ProgressDialog;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.util.Log;
import android.widget.ListView;
import android.widget.SimpleAdapter;
import android.widget.Toast;

import com.android.volley.Request;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.VolleyLog;
import com.android.volley.toolbox.JsonObjectRequest;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;

public class MainActivity_show extends AppCompatActivity {

    ListView documents;
    String url = "http://ec2-54-245-35-219.us-west-2.compute.amazonaws.com/api/getFiles";
    //listview
    boolean done = false;
    private String[] titleArray;
    private String[] subItemArray;
                                                                            //LOCALSTORAGE gebruiken voor token op te slagen
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main_show);

        documents = (ListView) findViewById(R.id.docViewer);
        getDocuments(); //get documents
        if(done){
            popList();//populate listview
        }
    }

    public void getDocuments(){

        JsonObjectRequest jsonObjReq = new JsonObjectRequest(Request.Method.GET,
                url, null, new Response.Listener<JSONObject>() {

            @Override
            public void onResponse(JSONObject response) {
                Log.d("Response get : ", response.toString());

                try {
                    // Parsing json object response
                    // response will be a json object

                    String name = response.getString("name");

                } catch (JSONException e) {
                    e.printStackTrace();
                    Toast.makeText(getApplicationContext(),
                            "Error: " + e.getMessage(),
                            Toast.LENGTH_LONG).show();
                }
            }
        }, new Response.ErrorListener() {

            @Override
            public void onErrorResponse(VolleyError error) {
                VolleyLog.d("Error: " + error.getMessage());
                Toast.makeText(getApplicationContext(),
                        error.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });

        // Adding request to request queue
        docRequest.getInstance().addToRequestQueue(jsonObjReq);
    }

    public void popList(){
        ArrayList<HashMap<String, String>> data;

            data = new ArrayList<HashMap<String, String>>();
            for(int i=0;i<titleArray.length;i++){
                HashMap<String,String> datum = new HashMap<String, String>();
                datum.put("title", titleArray[i]);
                datum.put("specs", subItemArray[i]);
                data.add(datum);
            }
            SimpleAdapter adapter = new SimpleAdapter(this, data, android.R.layout.simple_list_item_2, new String[] {"title", "specs"}, new int[] {android.R.id.text1, android.R.id.text2});
            documents.setAdapter(adapter);
    }
}


