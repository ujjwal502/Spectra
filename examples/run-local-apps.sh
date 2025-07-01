#!/bin/bash

# Exit on error
set -e

echo "===== Running all projects locally with authentication disabled ====="

# Define project paths
PROJECT1="/Users/ujjwal.tiwari/Desktop/spectra/examples/rp-ccs-ds-ao--hk-hbap-develop"
PROJECT2="/Users/ujjwal.tiwari/Desktop/spectra/examples/rp-ccs-ds-ao-router-hcc--hk-hbap-develop"
PROJECT3="/Users/ujjwal.tiwari/Desktop/spectra/examples/rp-ccs-decision-services-ao--hk-hbap-develop"

# Function to run a Spring Boot project
run_spring_boot() {
  project_path=$1
  project_name=$(basename "$project_path")
  port=$2
  
  echo ""
  echo "===== Running $project_name on port $port ====="
  echo ""
  
  cd "$project_path"
  
  # Set JVM arguments to disable security and set port
  export MAVEN_OPTS="-Dsecurity.enabled=false -Dauthz.enabled=false -Dserver.port=$port"
  
  # Run with local profile
  mvn spring-boot:run -Dspring-boot.run.profiles=local
}

# Ask which project to run
echo "Select a project to run:"
echo "1) rp-ccs-ds-ao--hk-hbap-develop (Spring Boot)"
echo "2) rp-ccs-ds-ao-router-hcc--hk-hbap-develop (Spring Boot)"
echo "3) rp-ccs-decision-services-ao--hk-hbap-develop (Mule)"
echo "4) Run all projects"
read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    run_spring_boot "$PROJECT1" 8080
    ;;
  2)
    run_spring_boot "$PROJECT2" 8081
    ;;
  3)
    echo ""
    echo "===== Running rp-ccs-decision-services-ao--hk-hbap-develop (Mule) ====="
    echo ""
    
    cd "$PROJECT3"
    # Note: For Mule, you might need Anypoint Studio or Mule runtime installed
    # Here we're trying to run it with Maven
    export MAVEN_OPTS="-Dmule.security.enabled=false"
    mvn clean package mule:run
    ;;
  4)
    # Run each project in a separate terminal window
    # For macOS
    osascript -e "tell application \"Terminal\" to do script \"cd $PROJECT1 && export MAVEN_OPTS=\\\"-Dsecurity.enabled=false -Dauthz.enabled=false -Dserver.port=8080\\\" && mvn spring-boot:run -Dspring-boot.run.profiles=local\""
    
    osascript -e "tell application \"Terminal\" to do script \"cd $PROJECT2 && export MAVEN_OPTS=\\\"-Dsecurity.enabled=false -Dauthz.enabled=false -Dserver.port=8081\\\" && mvn spring-boot:run -Dspring-boot.run.profiles=local\""
    
    osascript -e "tell application \"Terminal\" to do script \"cd $PROJECT3 && export MAVEN_OPTS=\\\"-Dmule.security.enabled=false\\\" && mvn clean package mule:run\""
    
    echo "All projects are running in separate terminal windows"
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac 