# Stage 1: Build the app with Maven
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -Dskip.frontend=true -B || true
COPY src ./src
RUN mvn clean package -Dskip.frontend=true -DskipTests -B

# Stage 2: Run the app with JRE
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/event-ticketing-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
