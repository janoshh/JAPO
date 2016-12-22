package com.example.janosh.japoapp;

import android.app.ProgressDialog;
import android.os.Bundle;
import android.support.v7.app.AppCompatActivity;
import android.util.Log;
import android.widget.ListView;
import android.widget.SimpleAdapter;

import com.android.volley.Request;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.VolleyLog;
import com.android.volley.toolbox.JsonObjectRequest;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;

public class MainActivity_show extends AppCompatActivity {

    ListView documents;
    String url = "http://ec2-54-245-35-219.us-west-2.compute.amazonaws.com/api/getFiles";
    static ProgressDialog pDialog;
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
        // Tag used to cancel the request
        String tag_json_obj = "json_obj_req";

        pDialog = new ProgressDialog(this);
        pDialog.setMessage("Loading...");
        pDialog.show();

        JsonObjectRequest jsonObjReq = new JsonObjectRequest(Request.Method.GET,
                url, null,
                new Response.Listener<JSONObject>() {

                    @Override
                    public void onResponse(JSONObject response) {
                        Log.d("RESPONSE: ", response.toString());
                        pDialog.hide();
                        //get data out of response
                        //jsonObject omvormen naar jsonArray
                        if (response.length() > 0) {
                            for(int i=0; i < response.length(); i ++){
                                //response.getJSONObject(i).toString());
                            }
                        }
                        // populate stringarrays to load listview
                        done = true;
                        titleArray = new String[]{};    //titles
                        subItemArray=new String[]{"tag: " + "",};    //document specs
                    }
                }, new Response.ErrorListener() {

            @Override
            public void onErrorResponse(VolleyError error) {
                VolleyLog.d("Error: " + error.getMessage());
                // hide the progress dialog
                pDialog.hide();
            }
        });

        // Adding request to request queue
        docRequest.getInstance().addToRequestQueue(jsonObjReq, tag_json_obj);
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


