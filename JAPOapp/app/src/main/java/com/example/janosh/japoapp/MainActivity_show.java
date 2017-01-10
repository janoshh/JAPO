package com.example.janosh.japoapp;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.text.Html;
import android.util.Log;
import android.widget.ListView;
import android.widget.SimpleAdapter;
import android.widget.Toast;

import com.android.volley.AuthFailureError;
import com.android.volley.Request;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.VolleyLog;
import com.android.volley.toolbox.JsonObjectRequest;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public class MainActivity_show extends AppCompatActivity {

    ListView documents;
    String url = "http://ec2-54-245-35-219.us-west-2.compute.amazonaws.com/api/getFiles";
    //listview
    public String[] titleArray;
    public String[] subItemArray;
    String token;
    String user;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main_show);
        documents = (ListView) findViewById(R.id.docViewer);

        SharedPreferences settings = getSharedPreferences("validation", MODE_PRIVATE);
        token = settings.getString("token", "Error loading token");
        user = settings.getString("user", "Error loading user");

        if (token != "Error loading token" && user != "Error loading user") {
            Log.d("token",token);
            Log.d("user",user);
        }
        else {
            Log.d("ERROR: ", "unable to find user or token");
        }


        getDocuments(); //get documents
    }

    public void getDocuments(){

        JsonObjectRequest jsonObjReq = new JsonObjectRequest(Request.Method.GET,
                url, null, new Response.Listener<JSONObject>() {

            @Override
            public void onResponse(JSONObject response) {
                Log.d("Response get : ", response.toString());

                try {
                    //TODO handle response
                    //handle response (array of objects)
                    JSONArray res = response.getJSONArray("files");
                    Log.d("RESARRAY: ",res.toString());
                    JSONArray jsonarray = res.getJSONArray(0);

                    titleArray = new String[jsonarray.length()];
                    subItemArray = new String[jsonarray.length()];

                    Log.d("ARRAY: ",jsonarray.toString());
                    for(int i=0; i<jsonarray.length();i++){
                        String size = "";
                        //get data
                        JSONObject jsonobject= jsonarray.getJSONObject(i);

                        String type=(String)jsonobject.get("filetype");
                        String name = jsonobject.get("customfilename") + type;
                        String tag=(String)jsonobject.get("tags");
                        double tempSize=Double.parseDouble((String)jsonobject.get("size"));
                        //check for empty strings
                        if(name.equals(type)) {
                            name = (String) jsonobject.get("filename");
                            name = name.substring(14); //get real filename without timestamp
                        } if(tag.equals("")){
                            tag = "No tag provided";
                        }
                        //check size
                        if(tempSize/1000000 > 1){
                            size = Double.toString(round(tempSize/1000000,2)) + " MB";
                        }else{
                            size = Double.toString(round(tempSize/1000,2)) + " kB";
                        }
                        //add to one string for the listview
                        String specs = "tag: " + tag + "  size: " + size;
                        Log.d("customfilename: ",name);
                        Log.d("specs : ",specs);
                        //add to titleArray
                        titleArray[i] = name;
                        subItemArray[i] = specs;
                    }
                    popList();//populate listview

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
        }
        ) {
            @Override
            public Map<String, String> getHeaders() throws AuthFailureError {
                Map<String, String> params = new HashMap<String, String>();
                params.put("x-access-token", token);
                params.put("user", user);
                return params;
            }
        };

        // Adding request to request queue
        docRequest.getInstance().addToRequestQueue(jsonObjReq);
    }

    public static double round(double value, int places) {
        if (places < 0) throw new IllegalArgumentException();

        long factor = (long) Math.pow(10, places);
        value = value * factor;
        long tmp = Math.round(value);
        return (double) tmp / factor;
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
        Log.d("POPULATED LIST","check");
    }
}


