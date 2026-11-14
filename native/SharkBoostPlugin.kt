package com.sharkboost.app

import android.app.ActivityManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.os.StatFs
import android.provider.Settings
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import kotlin.concurrent.thread

@CapacitorPlugin(name = "SharkBoost")
class SharkBoostPlugin : Plugin() {

    private val knownGamePackages = mapOf(
        "com.tencent.ig" to "PUBG Mobile",
        "com.pubg.krmobile" to "PUBG Mobile KR",
        "com.activision.callofduty.shooter" to "Call of Duty Mobile",
        "com.dts.freefireth" to "Free Fire",
        "com.dts.freefiremax" to "Free Fire MAX",
        "com.epicgames.fortnite" to "Fortnite",
        "com.miHoYo.GenshinImpact" to "Genshin Impact",
        "com.riotgames.league.wildrift" to "Wild Rift",
        "com.mobile.legends" to "Mobile Legends"
    )

    @PluginMethod
    fun getDeviceStats(call: PluginCall) {
        try {
            val result = JSObject()

            val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memInfo = ActivityManager.MemoryInfo()
            activityManager.getMemoryInfo(memInfo)

            val totalRamMb = memInfo.totalMem / (1024.0 * 1024.0)
            val availableRamMb = memInfo.availMem / (1024.0 * 1024.0)
            val usedRamMb = totalRamMb - availableRamMb

            val ramObj = JSObject()
            ramObj.put("totalMb", Math.round(totalRamMb))
            ramObj.put("availableMb", Math.round(availableRamMb))
            ramObj.put("usedMb", Math.round(usedRamMb))
            ramObj.put("lowMemory", memInfo.lowMemory)
            result.put("ram", ramObj)

            val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val batteryObj = JSObject()
            if (batteryIntent != null) {
                val level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
                val tempTenths = batteryIntent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1)
                val status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
                val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == BatteryManager.BATTERY_STATUS_FULL

                val pct = if (level >= 0 && scale > 0) Math.round((level * 100.0) / scale) else -1
                val tempC = if (tempTenths > 0) tempTenths / 10.0 else null

                batteryObj.put("levelPercent", pct)
                batteryObj.put("isCharging", isCharging)
                if (tempC != null) {
                    batteryObj.put("temperatureC", tempC)
                }
            }
            result.put("battery", batteryObj)

            val statFs = StatFs(Environment.getDataDirectory().path)
            val totalStorageBytes = statFs.totalBytes
            val availableStorageBytes = statFs.availableBytes
            val usedStorageBytes = totalStorageBytes - availableStorageBytes

            val storageObj = JSObject()
            storageObj.put("totalGb", Math.round((totalStorageBytes / (1024.0 * 1024.0 * 1024.0)) * 10.0) / 10.0)
            storageObj.put("availableGb", Math.round((availableStorageBytes / (1024.0 * 1024.0 * 1024.0)) * 10.0) / 10.0)
            storageObj.put("usedGb", Math.round((usedStorageBytes / (1024.0 * 1024.0 * 1024.0)) * 10.0) / 10.0)
            result.put("storage", storageObj)

            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val activeNetwork = cm.activeNetwork
            val caps = if (activeNetwork != null) cm.getNetworkCapabilities(activeNetwork) else null
            val netObj = JSObject()
            val connected = caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            val transportType = when {
                caps == null -> "none"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
                else -> "other"
            }
            netObj.put("connected", connected)
            netObj.put("type", transportType)
            if (caps != null) {
                netObj.put("downlinkKbps", caps.linkDownstreamBandwidthKbps)
                netObj.put("uplinkKbps", caps.linkUpstreamBandwidthKbps)
            }
            result.put("network", netObj)

            val deviceObj = JSObject()
            deviceObj.put("manufacturer", Build.MANUFACTURER)
            deviceObj.put("model", Build.MODEL)
            deviceObj.put("androidVersion", Build.VERSION.RELEASE)
            deviceObj.put("cpuCores", Runtime.getRuntime().availableProcessors())
            result.put("device", deviceObj)

            call.resolve(result)
        } catch (e: Exception) {
            call.reject("فشل في قراءة بيانات الجهاز: ${e.localizedMessage}", e)
        }
    }

    @PluginMethod
    fun getThermalStatus(call: PluginCall) {
        try {
            val result = JSObject()
            val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val tempTenths = batteryIntent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1) ?: -1
            val tempC = if (tempTenths > 0) tempTenths / 10.0 else null

            var statusLabel = "nominal"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                statusLabel = when (powerManager.currentThermalStatus) {
                    PowerManager.THERMAL_STATUS_NONE -> "nominal"
                    PowerManager.THERMAL_STATUS_LIGHT -> "light"
                    PowerManager.THERMAL_STATUS_MODERATE -> "moderate"
                    PowerManager.THERMAL_STATUS_SEVERE -> "severe"
                    PowerManager.THERMAL_STATUS_CRITICAL,
                    PowerManager.THERMAL_STATUS_EMERGENCY,
                    PowerManager.THERMAL_STATUS_SHUTDOWN -> "critical"
                    else -> "nominal"
                }
            } else if (tempC != null) {
                statusLabel = when {
                    tempC >= 44.0 -> "critical"
                    tempC >= 41.5 -> "severe"
                    tempC >= 39.0 -> "moderate"
                    else -> "nominal"
                }
            }

            if (tempC != null) {
                result.put("temperatureC", tempC)
            }
            result.put("thermalState", statusLabel)
            result.put("supported", true)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("فشل في قراءة حالة الحرارة: ${e.localizedMessage}", e)
        }
    }

    @PluginMethod
    fun measurePing(call: PluginCall) {
        val targetUrl = call.getString("url") ?: "https://1.1.1.1/cdn-cgi/trace"
        val samplesCount = (call.getInt("samples") ?: 5).coerceIn(1, 8)

        thread {
            val latencies = mutableListOf<Long>()
            var failures = 0

            for (i in 0 until samplesCount) {
                var conn: HttpURLConnection? = null
                try {
                    val startNs = System.nanoTime()
                    conn = (URL(targetUrl).openConnection() as HttpURLConnection).apply {
                        requestMethod = "HEAD"
                        connectTimeout = 3500
                        readTimeout = 3500
                        useCaches = false
                    }
                    conn.connect()
                    conn.responseCode
                    val elapsedMs = (System.nanoTime() - startNs) / 1_000_000L
                    latencies.add(elapsedMs)
                } catch (_: Exception) {
                    failures++
                } finally {
                    conn?.disconnect()
                }
            }

            if (latencies.isEmpty()) {
                call.reject("تعذر الوصول للخادم لقياس البنق الحقيقي")
                return@thread
            }

            val avg = Math.round(latencies.average()).toInt()
            val min = latencies.minOrNull()?.toInt() ?: avg
            val max = latencies.maxOrNull()?.toInt() ?: avg
            val jitter = if (latencies.size > 1) {
                val diffs = latencies.zipWithNext { a, b -> kotlin.math.abs(a - b) }
                Math.round(diffs.average()).toInt()
            } else 0

            val result = JSObject()
            result.put("avgMs", avg)
            result.put("minMs", min)
            result.put("maxMs", max)
            result.put("jitterMs", jitter)
            result.put("packetLossPercent", Math.round((failures * 100.0) / samplesCount))
            result.put("target", targetUrl)
            call.resolve(result)
        }
    }

    @PluginMethod
    fun measureDnsPing(call: PluginCall) {
        val ip = call.getString("ip") ?: "1.1.1.1"
        thread {
            val samples = mutableListOf<Long>()
            for (i in 0 until 3) {
                val socket = Socket()
                try {
                    val startNs = System.nanoTime()
                    socket.connect(InetSocketAddress(ip, 53), 2500)
                    val elapsedMs = (System.nanoTime() - startNs) / 1_000_000L
                    samples.add(elapsedMs)
                } catch (_: Exception) {
                    // Ignore failed sample
                } finally {
                    try {
                        socket.close()
                    } catch (_: Exception) {
                    }
                }
            }
            if (samples.isEmpty()) {
                call.reject("تعذر الاتصال بخادم DNS $ip")
                return@thread
            }
            val result = JSObject()
            result.put("ip", ip)
            result.put("latencyMs", Math.round(samples.average()).toInt())
            call.resolve(result)
        }
    }

    @PluginMethod
    fun launchGame(call: PluginCall) {
        val packageName = call.getString("packageName") ?: ""
        if (packageName.isBlank()) {
            call.reject("اسم حزمة اللعبة غير محدد")
            return
        }
        try {
            val pm = context.packageManager
            val intent = pm.getLaunchIntentForPackage(packageName)
            if (intent == null) {
                val res = JSObject()
                res.put("launched", false)
                res.put("reason", "اللعبة غير مثبتة على هذا الجهاز ($packageName)")
                call.resolve(res)
                return
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            val res = JSObject()
            res.put("launched", true)
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("تعذر فتح اللعبة: ${e.localizedMessage}", e)
        }
    }

    @PluginMethod
    fun setDoNotDisturb(call: PluginCall) {
        val enabled = call.getBoolean("enabled", true) ?: true
        try {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (!nm.isNotificationPolicyAccessGranted) {
                val settingsIntent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(settingsIntent)
                val res = JSObject()
                res.put("applied", false)
                res.put("permissionRequired", true)
                res.put("message", "فعّل إذن عدم الإزعاج لـ GameMind من الإعدادات اللي انفتحت الحين")
                call.resolve(res)
                return
            }

            nm.setInterruptionFilter(
                if (enabled) NotificationManager.INTERRUPTION_FILTER_PRIORITY
                else NotificationManager.INTERRUPTION_FILTER_ALL
            )
            val res = JSObject()
            res.put("applied", true)
            res.put("permissionRequired", false)
            res.put("enabled", enabled)
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("تعذر تغيير وضع عدم الإزعاج: ${e.localizedMessage}", e)
        }
    }

    @PluginMethod
    fun getInstalledGamesStorage(call: PluginCall) {
        try {
            val pm = context.packageManager
            val packages = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            val list = JSArray()

            for (appInfo in packages) {
                val isKnownGame = knownGamePackages.containsKey(appInfo.packageName)
                val isCategoryGame = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                    appInfo.category == ApplicationInfo.CATEGORY_GAME
                if (isKnownGame || isCategoryGame) {
                    val label = knownGamePackages[appInfo.packageName]
                        ?: pm.getApplicationLabel(appInfo).toString()
                    val apkFile = File(appInfo.sourceDir)
                    val apkMb = if (apkFile.exists()) Math.round(apkFile.length() / (1024.0 * 1024.0)) else 0L

                    val obj = JSObject()
                    obj.put("name", label)
                    obj.put("packageName", appInfo.packageName)
                    obj.put("apkSizeMb", apkMb)
                    list.put(obj)
                }
            }

            val res = JSObject()
            res.put("games", list)
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("تعذر فحص الألعاب المثبتة: ${e.localizedMessage}", e)
        }
    }

    @PluginMethod
    fun openStorageSettings(call: PluginCall) {
        try {
            val intent = Intent(Settings.ACTION_INTERNAL_STORAGE_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            val res = JSObject()
            res.put("opened", true)
            call.resolve(res)
        } catch (e: Exception) {
            call.reject("تعذر فتح إعدادات التخزين: ${e.localizedMessage}", e)
        }
    }
}
