package com.example.config;

import com.example.security.AdminTopicSubscriptionInterceptor;
import com.example.security.JwtStompChannelInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final String[] frontendOrigins;
    private final JwtStompChannelInterceptor jwtInterceptor;
    private final AdminTopicSubscriptionInterceptor adminTopicInterceptor;

    public WebSocketConfig(@Value("${app.frontend-urls:http://localhost:5173}") String frontendUrls,
                           JwtStompChannelInterceptor jwtInterceptor,
                           AdminTopicSubscriptionInterceptor adminTopicInterceptor) {
        this.frontendOrigins = Arrays.stream(frontendUrls.split(","))
                .map(String::trim).filter(s -> !s.isBlank()).toArray(String[]::new);
        this.jwtInterceptor = jwtInterceptor;
        this.adminTopicInterceptor = adminTopicInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Plus d'intercepteur de handshake lié aux cookies : l'identité vient du CONNECT STOMP
        registry.addEndpoint("/ws").setAllowedOrigins(frontendOrigins).withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Ordre important : d'abord l'authentification, ensuite le contrôle des canaux
        registration.interceptors(jwtInterceptor, adminTopicInterceptor);
    }
}