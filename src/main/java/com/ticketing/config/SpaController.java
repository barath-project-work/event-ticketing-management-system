package com.ticketing.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Forwards SPA routes to index.html so React Router can handle client-side navigation.
 * <p>
 * This is needed because the React SPA is embedded as static resources in the Spring Boot jar.
 * All routes that are not API endpoints, admin endpoints, actuator endpoints, or static resources
 * should be forwarded to the SPA's index.html.
 */
@Controller
public class SpaController {

    @GetMapping(value = {
        "/",
        "/events",
        "/events/**",
        "/reservations",
        "/admin",
        "/admin/**"
    })
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}
