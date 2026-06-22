package com.ticketing.config;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Forwards all SPA routes (non-API, non-actuator 404s) to index.html
 * so that React Router can handle client-side routing.
 * <p>
 * This is the catch-all for paths not matched by {@link SpaController}.
 */
@Controller
public class SPAErrorController implements ErrorController {

    @RequestMapping("/error")
    public String handleError(HttpServletRequest request) {
        Object status = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        if (status != null) {
            int statusCode = Integer.parseInt(status.toString());
            // Only forward 404s to SPA - let other errors pass through
            if (statusCode == HttpStatus.NOT_FOUND.value()) {
                String requestUri = (String) request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI);
                // Don't forward API, actuator, or WebSocket paths
                if (requestUri != null && !requestUri.startsWith("/api")
                    && !requestUri.startsWith("/actuator")
                    && !requestUri.startsWith("/ws")) {
                    return "forward:/index.html";
                }
            }
        }
        return "error";
    }
}
