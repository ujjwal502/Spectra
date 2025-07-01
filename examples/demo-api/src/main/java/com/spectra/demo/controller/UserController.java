package com.spectra.demo.controller;

import com.spectra.demo.model.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * User REST Controller for Spectra Demo API
 * 
 * Provides comprehensive CRUD operations with various response scenarios
 * to demonstrate Spectra's testing capabilities:
 * - Different HTTP methods (GET, POST, PUT, DELETE)
 * - Path parameters and request bodies
 * - Validation and error handling
 * - Multiple response codes (200, 201, 400, 404, 500)
 */
@RestController
@RequestMapping("/api/v1/users")
@Validated
public class UserController {
    
    private final Map<Long, User> users = new ConcurrentHashMap<>();
    private final AtomicLong counter = new AtomicLong(1);
    
    public UserController() {
        // Pre-populate with demo data
        initializeDemoData();
    }
    
    /**
     * Get all users
     * @return List of all users
     */
    @GetMapping
    public ResponseEntity<List<User>> getAllUsers() {
        System.out.println("🔍 [DEMO-API] GET /api/v1/users - Request received");
        System.out.println("🔍 [DEMO-API] Current users in database: " + users.size());
        
        List<User> userList = new ArrayList<>(users.values());
        System.out.println("🔍 [DEMO-API] Returning " + userList.size() + " users");
        System.out.println("✅ [DEMO-API] GET /api/v1/users - Success (200)");
        
        return ResponseEntity.ok(userList);
    }
    
    /**
     * Get user by ID
     * @param id User ID
     * @return User details or 404 if not found
     */
    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        System.out.println("🔍 [DEMO-API] GET /api/v1/users/" + id + " - Request received");
        System.out.println("🔍 [DEMO-API] Path variable 'id' = " + id + " (type: " + id.getClass().getSimpleName() + ")");
        System.out.println("🔍 [DEMO-API] Available user IDs: " + users.keySet());
        
        // Simulate server error for ID 999 (for error testing)
        if (id == 999) {
            System.out.println("❌ [DEMO-API] Simulating server error for ID 999");
            throw new RuntimeException("Simulated server error for testing");
        }
        
        User user = users.get(id);
        if (user == null) {
            System.out.println("❌ [DEMO-API] User with ID " + id + " not found - Returning 404");
            return ResponseEntity.notFound().build();
        }
        
        System.out.println("✅ [DEMO-API] User found: " + user.getName() + " - Returning 200");
        return ResponseEntity.ok(user);
    }
    
    /**
     * Create a new user
     * @param user User data
     * @return Created user with generated ID
     */
    @PostMapping
    public ResponseEntity<User> createUser(@Valid @RequestBody User user) {
        System.out.println("🔍 [DEMO-API] POST /api/v1/users - Request received");
        System.out.println("🔍 [DEMO-API] Request body: " + user);
        System.out.println("🔍 [DEMO-API] User data - Name: " + user.getName() + ", Email: " + user.getEmail() + ", Age: " + user.getAge());
        
        // Check for duplicate email
        boolean emailExists = users.values().stream()
                .anyMatch(existingUser -> existingUser.getEmail().equals(user.getEmail()));
        
        if (emailExists) {
            System.out.println("❌ [DEMO-API] Duplicate email detected: " + user.getEmail() + " - Returning 400");
            return ResponseEntity.badRequest().build();
        }
        
        // Generate ID and save
        Long id = counter.getAndIncrement();
        user.setId(id);
        users.put(id, user);
        
        System.out.println("✅ [DEMO-API] User created successfully with ID: " + id + " - Returning 201");
        System.out.println("🔍 [DEMO-API] Total users now: " + users.size());
        
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }
    
    /**
     * Update an existing user
     * @param id User ID
     * @param userUpdate Updated user data
     * @return Updated user or 404 if not found
     */
    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @Valid @RequestBody User userUpdate) {
        System.out.println("🔍 [DEMO-API] PUT /api/v1/users/" + id + " - Request received");
        System.out.println("🔍 [DEMO-API] Path variable 'id' = " + id + " (type: " + id.getClass().getSimpleName() + ")");
        System.out.println("🔍 [DEMO-API] Request body: " + userUpdate);
        System.out.println("🔍 [DEMO-API] Available user IDs: " + users.keySet());
        
        User existingUser = users.get(id);
        if (existingUser == null) {
            System.out.println("❌ [DEMO-API] User with ID " + id + " not found - Returning 404");
            return ResponseEntity.notFound().build();
        }
        
        System.out.println("🔍 [DEMO-API] Existing user: " + existingUser.getName());
        
        // Check for duplicate email (excluding current user)
        boolean emailExists = users.values().stream()
                .anyMatch(user -> !user.getId().equals(id) && 
                         user.getEmail().equals(userUpdate.getEmail()));
        
        if (emailExists) {
            System.out.println("❌ [DEMO-API] Duplicate email detected: " + userUpdate.getEmail() + " - Returning 400");
            return ResponseEntity.badRequest().build();
        }
        
        // Update user
        userUpdate.setId(id);
        users.put(id, userUpdate);
        
        System.out.println("✅ [DEMO-API] User updated successfully - Name: " + userUpdate.getName() + " - Returning 200");
        
        return ResponseEntity.ok(userUpdate);
    }
    
    /**
     * Delete a user
     * @param id User ID
     * @return 204 No Content if successful, 404 if not found
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        System.out.println("🔍 [DEMO-API] DELETE /api/v1/users/" + id + " - Request received");
        System.out.println("🔍 [DEMO-API] Path variable 'id' = " + id + " (type: " + id.getClass().getSimpleName() + ")");
        System.out.println("🔍 [DEMO-API] Available user IDs before deletion: " + users.keySet());
        
        User removedUser = users.remove(id);
        if (removedUser == null) {
            System.out.println("❌ [DEMO-API] User with ID " + id + " not found - Returning 404");
            return ResponseEntity.notFound().build();
        }
        
        System.out.println("✅ [DEMO-API] User " + removedUser.getName() + " (ID: " + id + ") deleted successfully - Returning 204");
        System.out.println("🔍 [DEMO-API] Remaining users: " + users.size());
        
        return ResponseEntity.noContent().build();
    }
    
    /**
     * Get users by department (demonstrates query parameters)
     * @param department Department name
     * @return List of users in the department
     */
    @GetMapping("/department/{department}")
    public ResponseEntity<List<User>> getUsersByDepartment(@PathVariable String department) {
        System.out.println("🔍 [DEMO-API] GET /api/v1/users/department/" + department + " - Request received");
        System.out.println("🔍 [DEMO-API] Department parameter: '" + department + "'");
        System.out.println("🔍 [DEMO-API] Available departments: " + users.values().stream().map(User::getDepartment).distinct().toList());
        
        List<User> departmentUsers = users.values().stream()
                .filter(user -> department.equalsIgnoreCase(user.getDepartment()))
                .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
        
        System.out.println("✅ [DEMO-API] Found " + departmentUsers.size() + " users in department '" + department + "' - Returning 200");
        
        return ResponseEntity.ok(departmentUsers);
    }
    
    /**
     * Reset demo data for testing (useful for test isolation)
     * @return Reset confirmation
     */
    @PostMapping("/reset-test-data")
    public ResponseEntity<Map<String, Object>> resetTestData() {
        System.out.println("🔄 [DEMO-API] RESET TEST DATA - Request received");
        
        users.clear();
        initializeDemoData();
        
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Test data reset successfully");
        response.put("userCount", users.size());
        response.put("availableIds", users.keySet());
        
        System.out.println("✅ [DEMO-API] Test data reset completed - Users: " + users.keySet());
        
        return ResponseEntity.ok(response);
    }

    /**
     * Initialize demo data for testing
     */
    private void initializeDemoData() {
        users.put(1L, new User(1L, "John Doe", "john.doe@example.com", 30, "Engineering"));
        users.put(2L, new User(2L, "Jane Smith", "jane.smith@example.com", 28, "Marketing"));
        users.put(3L, new User(3L, "Bob Johnson", "bob.johnson@example.com", 35, "Engineering"));
        counter.set(4L);
    }
    
    /**
     * Global exception handler for demonstration
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException e) {
        System.out.println("❌ [DEMO-API] Exception occurred: " + e.getMessage());
        System.out.println("❌ [DEMO-API] Exception type: " + e.getClass().getSimpleName());
        
        Map<String, String> error = new HashMap<>();
        error.put("error", "Internal Server Error");
        error.put("message", e.getMessage());
        
        System.out.println("❌ [DEMO-API] Returning 500 with error: " + error);
        
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
} 