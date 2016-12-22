package com.example.janosh.japoapp;
import com.android.volley.Response;
import com.android.volley.toolbox.StringRequest;
import java.util.HashMap;
import java.util.Map;

/**
 * Created by Janosh on 15/12/2016.
 */

public class LoginRequest extends StringRequest {
    private static final String LOGIN_REQUEST_URL = "http://ec2-54-245-35-219.us-west-2.compute.amazonaws.com/api/authenticate";
    private Map<String, String> params;

    public LoginRequest(String name, String password, Response.Listener<String>listener){
        super(Method.POST, LOGIN_REQUEST_URL, listener, null);
        params = new HashMap<>();
        params.put("name", name);
        params.put("password", password);
    }

    @Override
    public Map<String, String> getParams(){
        return params;
    }
}
