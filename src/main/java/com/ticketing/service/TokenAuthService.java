package com.ticketing.service;

import com.ticketing.model.User;
import com.ticketing.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TokenAuthService {

    private final UserRepository userRepository;

    public User authenticate(String token) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("API token is required");
        }
        return userRepository.findByToken(token)
            .orElseThrow(() -> new IllegalArgumentException("Invalid API token: " + token));
    }
}
