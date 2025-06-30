package com.spectra.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Main application class for the Spectra Demo API
 * A simple REST API designed for demonstrating Spectra's testing capabilities
 */
@SpringBootApplication
public class DemoApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApiApplication.class, args);
        System.out.println("🚀 Spectra Demo API started on http://localhost:8081");
        System.out.println("📖 API Documentation: http://localhost:8081/api/v1/users");
        System.out.println("✨ Ready for Spectra testing demonstration!");
    }
} 